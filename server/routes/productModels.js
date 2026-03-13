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
    res.json(models);
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
  const { PackItem } = require('../models');
  try {
    const { items } = req.body; // Array of { productId, quantity }
    const packId = req.params.id;

    const model = await ProductModel.findByPk(packId);
    if (!model) return res.status(404).json({ error: 'Model not found.' });

    // Clear existing Pack Items
    await PackItem.destroy({ where: { packId } });

    // Add new Pack Items
    if (items && items.length > 0) {
      const packData = items.map(i => ({
        packId,
        productId: i.productId,
        quantity: i.quantity,
      }));
      await PackItem.bulkCreate(packData);
    }

    res.json({ message: 'Pack updated successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
