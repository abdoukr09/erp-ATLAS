const express = require('express');
const { ProductModel, Material, ModelMaterial, PackItem } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

// GET all product models
router.get('/', authenticate, async (req, res) => {
  try {
    const models = await ProductModel.findAll({
      include: [
        { model: Material, as: 'materials', through: { attributes: ['quantity'] } },
        { 
          model: PackItem, 
          as: 'packItems', 
          include: [{ model: ProductModel, as: 'product', attributes: ['id', 'name', 'basePrice'] }] 
        }
      ],
      order: [['name', 'ASC']],
    });

    const enrichedModels = models.map(model => {
      const plainModel = model.get({ plain: true });
      let maxProducible = -1; // -1 means no limitation found (or no BOM)

      if (plainModel.materials && plainModel.materials.length > 0) {
        for (const mat of plainModel.materials) {
          const reqQty = mat.ModelMaterial?.quantity || 0;
          if (reqQty > 0) {
            const currentStock = Number(mat.stock) || 0;
            const possible = Math.floor(currentStock / reqQty);
            if (maxProducible === -1 || possible < maxProducible) {
              maxProducible = possible;
            }
          }
        }
      } else {
        maxProducible = null; // null means it's a direct purchase item with no BOM required
      }

      plainModel.maxProducible = maxProducible;
      return plainModel;
    });

    res.json(enrichedModels);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// CREATE a product model
router.post('/', authenticate, authorize('admin', 'gerant', 'production'), async (req, res) => {
  try {
    const { name, category, description, basePrice, isPack } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required.' });

    const model = await ProductModel.create({ name, category, description, basePrice, isPack });
    res.status(201).json(model);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Model name already exists.' });
    }
    console.error('Model Creation Error:', error.message, error.errors);
    res.status(500).json({ error: error.message || 'Server error.' });
  }
});

// DELETE a product model
router.delete('/:id', authenticate, authorize('admin', 'gerant', 'production'), async (req, res) => {
  try {
    const model = await ProductModel.findByPk(req.params.id);
    if (!model) return res.status(404).json({ error: 'Model not found.' });

    await model.destroy();
    res.json({ message: 'Model deleted successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// UPDATE a product model
router.put('/:id', authenticate, authorize('admin', 'gerant', 'production'), async (req, res) => {
  try {
    const { name, category, description, basePrice, isPack } = req.body;
    const model = await ProductModel.findByPk(req.params.id);
    if (!model) return res.status(404).json({ error: 'Model not found.' });

    await model.update({ name, category, description, basePrice, isPack });
    res.json(model);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Model name already exists.' });
    }
    console.error('Model Update Error:', error.message, error.errors);
    res.status(500).json({ error: error.message || 'Server error.' });
  }
});

// GET BOM for a specific model
router.get('/:id/bom', authenticate, async (req, res) => {
  try {
    const bom = await ModelMaterial.findAll({
      where: { modelId: req.params.id },
      include: [{ model: Material, attributes: ['id', 'name', 'unit'] }],
    });
    res.json(bom);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// UPDATE BOM for a specific model
router.post('/:id/bom', authenticate, authorize('admin', 'gerant', 'production'), async (req, res) => {
  try {
    const { materials } = req.body; // Array of { materialId, quantity }
    const modelId = req.params.id;

    const model = await ProductModel.findByPk(modelId);
    if (!model) return res.status(404).json({ error: 'Model not found.' });

    // Clear existing BOM
    await ModelMaterial.destroy({ where: { modelId } });

    // Add new BOM entries
    if (materials && materials.length > 0) {
      const bomData = materials.map(m => ({
        modelId,
        materialId: m.materialId,
        quantity: m.quantity,
      }));
      await ModelMaterial.bulkCreate(bomData);
    }

    res.json({ message: 'BOM updated successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// UPDATE Pack Items for a specific model
router.post('/:id/pack', authenticate, authorize('admin', 'gerant', 'production'), async (req, res) => {
  const t = await ProductModel.sequelize.transaction();
  try {
    const { items } = req.body; // Array of { productId, quantity }
    const packId = req.params.id;

    const model = await ProductModel.findByPk(packId);
    if (!model) {
      await t.rollback();
      return res.status(404).json({ error: 'Model not found.' });
    }

    // 1. Save pack items
    await PackItem.destroy({ where: { packId }, transaction: t });
    if (items && items.length > 0) {
      await PackItem.bulkCreate(
        items.map(i => ({ packId, productId: i.productId, quantity: i.quantity })),
        { transaction: t }
      );
    }

    // 2. Auto-calculate pack BOM = sum of each product's materials × quantity in pack
    const aggregated = {}; // { materialId: totalQuantity }

    if (items && items.length > 0) {
      for (const item of items) {
        // Load this product's BOM
        const productBom = await ModelMaterial.findAll({
          where: { modelId: item.productId },
          transaction: t,
        });
        for (const entry of productBom) {
          const mid = entry.materialId;
          const qty = Number(entry.quantity) * Number(item.quantity);
          aggregated[mid] = (aggregated[mid] || 0) + qty;
        }
      }
    }

    // 3. Write the aggregated BOM to the pack's model_materials
    await ModelMaterial.destroy({ where: { modelId: packId }, transaction: t });
    const bomData = Object.entries(aggregated).map(([materialId, quantity]) => ({
      modelId: packId,
      materialId: Number(materialId),
      quantity,
    }));
    if (bomData.length > 0) {
      await ModelMaterial.bulkCreate(bomData, { transaction: t });
    }

    await t.commit();
    res.json({ message: 'Pack updated and BOM auto-calculated successfully.', bomEntries: bomData.length });
  } catch (error) {
    await t.rollback();
    console.error(error);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
