const express = require('express');
const { Production, Order, Customer, ProductModel } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const sequelize = require('../config/database');
const router = express.Router();

// Helper to deduct materials
const deductMaterials = async (orderId, productModelId, targetQuantity, t) => {
  const { ProductModel, Material, PackItem } = require('../models');
  let targetModel = null;

  if (orderId) {
    const { Order } = require('../models');
    const order = await Order.findByPk(orderId, { transaction: t });
    if (order) {
      targetModel = await ProductModel.findOne({ where: { name: order.sofaModel }, transaction: t });
    }
  } else if (productModelId) {
    targetModel = await ProductModel.findByPk(productModelId, { transaction: t });
  }

  if (!targetModel) return false;

  const materialMap = new Map(); // materialId -> totalQuantity

  const collect = async (modelId, multiplier) => {
    const model = await ProductModel.findByPk(modelId, {
      include: [
        { model: Material, as: 'materials' },
        { model: PackItem, as: 'packItems' }
      ],
      transaction: t
    });

    if (!model) return;

    // Add direct materials
    if (model.materials && model.materials.length > 0) {
      for (const material of model.materials) {
        const requiredQty = material.ModelMaterial.quantity * multiplier;
        const currentTotal = materialMap.get(material.id) || 0;
        materialMap.set(material.id, currentTotal + requiredQty);
      }
    }

    // Recursively collect from pack items
    if (model.isPack && model.packItems && model.packItems.length > 0) {
      for (const item of model.packItems) {
        await collect(item.productId, item.quantity * multiplier);
      }
    }
  };

  await collect(targetModel.id, targetQuantity);

  // Deduct collected materials
  if (materialMap.size > 0) {
    for (const [materialId, totalRequired] of materialMap.entries()) {
      if (totalRequired > 0) {
        const material = await Material.findByPk(materialId, { transaction: t });
        if (!material || material.stock < totalRequired) {
          throw new Error(`Stock insuffisant pour ${material?.name || 'Inconnu'}. Requis: ${totalRequired}, Disponible: ${material?.stock || 0}`);
        }
        await material.update({ stock: material.stock - totalRequired }, { transaction: t });
      }
    }
    return true;
  }
  
  return false; // No materials found to deduct
};

// GET /api/production
router.get('/', authenticate, authorize('admin', 'production', 'gerant'), async (req, res) => {
  try {
    const productions = await Production.findAll({
      include: [
        { model: Order, as: 'order', attributes: ['id', 'sofaModel', 'quantity', 'status'], include: [{ model: Customer, as: 'customer', attributes: ['name'] }] },
        { model: ProductModel, as: 'productModel', attributes: ['id', 'name'] }
      ],
      order: [['createdAt', 'DESC']],
    });
    res.json(productions);
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/production — creates in pending, NO material deduction yet
router.post('/', authenticate, authorize('admin', 'production', 'gerant'), async (req, res) => {
  const t = await Production.sequelize.transaction();
  try {
    let { orderId, productModelId, stage, worker, notes, startDate, status } = req.body;
    if (orderId === '') orderId = null;
    if (productModelId === '') productModelId = null;
    if (!orderId && !productModelId) {
      await t.rollback();
      return res.status(400).json({ error: 'Order ID or Product Model ID is required.' });
    }

    if (orderId) {
      const order = await Order.findByPk(orderId, { transaction: t });
      if (order && order.status === 'pending') {
        await order.update({ status: 'in_production' }, { transaction: t });
      }
    }

    // Force status to pending on creation — materials are deducted when moving to in_progress
    const production = await Production.create({
      orderId, productModelId, stage: stage || 'fabrication', worker, notes,
      startDate: startDate || new Date(),
      status: 'pending',
      materialsDeducted: false
    }, { transaction: t });

    await t.commit();
    res.status(201).json(production);
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    res.status(500).json({ error: 'Server error during production initialization.' });
  }
});

// PUT /api/production/:id
router.put('/:id', authenticate, authorize('admin', 'production', 'gerant'), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    if (req.body.orderId === '') req.body.orderId = null;
    if (req.body.productModelId === '') req.body.productModelId = null;
    const production = await Production.findByPk(req.params.id, {
      include: [{ model: Order, as: 'order' }],
      transaction: t
    });
    
    if (!production) {
      await t.rollback();
      return res.status(404).json({ error: 'Production record not found.' });
    }

    const newStatus = req.body.status;
    const needsDeduction = !production.materialsDeducted && 
      (newStatus === 'in_progress' || newStatus === 'completed') &&
      production.status !== newStatus;

    // Deduct materials when moving to in_progress or completed
    if (needsDeduction) {
      let qty = 1;
      if (production.order) qty = production.order.quantity;
      try {
        const deducted = await deductMaterials(production.orderId, production.productModelId, qty, t);
        req.body.materialsDeducted = deducted;
      } catch (err) {
        await t.rollback();
        return res.status(400).json({ error: err.message });
      }
    }

    // If completing, mark order as ready OR increment Model Stock
    if (newStatus === 'completed' && production.status !== 'completed') {
      if (production.order) {
        await production.order.update({ status: 'ready' }, { transaction: t });
      } else if (production.productModelId) {
        const model = await ProductModel.findByPk(production.productModelId, { transaction: t });
        if (model) {
          await model.update({ stock: (model.stock || 0) + 1 }, { transaction: t });
        }
      }
      req.body.endDate = new Date();
    }

    await production.update(req.body, { transaction: t });
    await t.commit();
    res.json(production);
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error('Update Production Error:', error);
    res.status(500).json({ error: 'Server error: ' + (error.message || 'Unknown error') });
  }
});

// DELETE /api/production/:id
router.delete('/:id', authenticate, authorize('admin', 'production', 'gerant'), async (req, res) => {
  try {
    const production = await Production.findByPk(req.params.id);
    if (!production) return res.status(404).json({ error: 'Production record not found.' });

    await production.destroy();
    res.json({ message: 'Production record deleted.' });
  } catch (error) {
    console.error('Delete Production Error:', error);
    res.status(500).json({ error: 'Server error: ' + (error.message || 'Unknown error') });
  }
});

module.exports = router;
