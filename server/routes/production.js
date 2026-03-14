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

    // Add direct materials (which for Packs contains the fully calculated BOM too)
    if (model.materials && model.materials.length > 0) {
      for (const material of model.materials) {
        const requiredQty = material.ModelMaterial.quantity * multiplier;
        const currentTotal = materialMap.get(material.id) || 0;
        materialMap.set(material.id, currentTotal + requiredQty);
      }
    }
  };

  await collect(targetModel.id, targetQuantity);

  // Deduct collected materials
  if (materialMap.size > 0) {
    for (const [materialId, totalRequired] of materialMap.entries()) {
      if (totalRequired > 0) {
        const material = await Material.findByPk(materialId, { transaction: t });
        if (material) {
           // Allow stock to go negative. Don't block production in real-world factory workflows!
           await material.update({ stock: Number(material.stock || 0) - totalRequired }, { transaction: t });
        }
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
    let { orderId, productModelId, notes, startDate, tasks, quantity } = req.body;
    if (orderId === '') orderId = null;
    if (productModelId === '') productModelId = null;
    if (!orderId && !productModelId) {
      await t.rollback();
      return res.status(400).json({ error: 'Order ID or Product Model ID is required.' });
    }

    let basePrice = null;
    let finalQuantity = quantity || 1;

    if (orderId) {
      const order = await Order.findByPk(orderId, { transaction: t });
      if (order) {
        if (order.status === 'pending') {
          await order.update({ status: 'in_production' }, { transaction: t });
        }
        basePrice = order.totalPrice; // This is the final price after discount
        finalQuantity = order.quantity;
      }
    } else if (productModelId) {
      const pm = await ProductModel.findByPk(productModelId, { transaction: t });
      if (pm) {
        basePrice = pm.basePrice;
      }
    }

    // Default to a single generic task if UI didn't send an array (fallback for old UI)
    const assignments = (tasks && tasks.length > 0) ? tasks : [{
       stage: req.body.stage || 'fabrication',
       worker: req.body.worker,
       completedById: req.body.completedById || null,
       taskName: 'Fabrication Globale',
       commissionType: 'percentage',
       commissionValue: 0
    }];

    const createdRecords = [];

    // Force status to pending on creation — materials are deducted when moving to in_progress
    // Create one production record PER TASK/WORKER
    for (const task of assignments) {
       let commissionType = task.commissionType;
       let commissionValue = task.commissionValue;

       // If not provided or zero, try to get from Employee's profile
       if (task.completedById && (!commissionValue || commissionValue === 0)) {
          const { Employee } = require('../models');
          const emp = await Employee.findByPk(task.completedById, { transaction: t });
          if (emp) {
            commissionType = 'percentage';
            commissionValue = Number(emp.commissionRate || 0);
          }
       }
       
       const production = await Production.create({
         orderId, 
         productModelId, 
         stage: task.stage || 'fabrication', 
         worker: task.workerName || task.worker || '', 
         notes,
         startDate: startDate || new Date(),
         status: 'pending',
         materialsDeducted: false,
         completedById: task.completedById || null,
         taskName: task.taskName || 'Fabrication',
         commissionType: commissionType || 'percentage',
         commissionValue: commissionValue || 0,
         basePrice: basePrice,
         quantity: finalQuantity
       }, { transaction: t });
       
       createdRecords.push(production);
    }

    await t.commit();
    res.status(201).json(createdRecords);
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    res.status(500).json({ error: 'Server error during production initialization: ' + error.message });
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
      req.body.completionDate = new Date();
      if(req.body.completedById === '') req.body.completedById = null;
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

// Helper to revert materials (return to stock)
const revertMaterials = async (orderId, productModelId, targetQuantity, t) => {
  const { ProductModel, Material } = require('../models');
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

  if (!targetModel) return;

  const model = await ProductModel.findByPk(targetModel.id, {
    include: [{ model: Material, as: 'materials' }],
    transaction: t
  });

  if (model && model.materials) {
    for (const material of model.materials) {
      const requiredQty = material.ModelMaterial.quantity * targetQuantity;
      await material.update({ stock: Number(material.stock) + requiredQty }, { transaction: t });
    }
  }
};

// DELETE /api/production/:id
router.delete('/:id', authenticate, authorize('admin', 'production', 'gerant'), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const production = await Production.findByPk(req.params.id, {
      include: [{ model: Order, as: 'order' }],
      transaction: t
    });
    if (!production) {
      await t.rollback();
      return res.status(404).json({ error: 'Production record not found.' });
    }

    // If materials were deducted, revert them
    if (production.materialsDeducted) {
      let qty = 1;
      if (production.order) qty = production.order.quantity;
      await revertMaterials(production.orderId, production.productModelId, qty, t);
    }

    await production.destroy({ transaction: t });
    await t.commit();
    res.json({ message: 'Production record deleted and materials reverted if necessary.' });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error('Delete Production Error:', error);
    res.status(500).json({ error: 'Server error: ' + (error.message || 'Unknown error') });
  }
});

module.exports = router;
