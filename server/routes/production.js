const express = require('express');
const { Production, Order, Customer, ProductModel, OrderItem, ProductionWorker, Employee, MaterialReservation } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const sequelize = require('../config/database');
const router = express.Router();

// Helper to deduct materials
const deductMaterials = async (orderItemId, productModelId, targetQuantity, t) => {
  const { ProductModel, Material, PackItem } = require('../models');
  let targetModel = null;

  if (orderItemId) {
    const { OrderItem } = require('../models');
    const item = await OrderItem.findByPk(orderItemId, { transaction: t });
    if (item) {
      targetModel = await ProductModel.findOne({ where: { name: item.sofaModel }, transaction: t });
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
        const material = await Material.findByPk(materialId, { transaction: t, lock: t.LOCK.UPDATE });
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
        { model: OrderItem, as: 'orderItem', attributes: ['id', 'sofaModel', 'quantity', 'status'], include: [{ model: Order, as: 'order', attributes: ['id', 'status'], include: [{ model: Customer, as: 'customer', attributes: ['name'] }] }] },
        { model: ProductModel, as: 'productModel', attributes: ['id', 'name'] },
        { model: ProductionWorker, as: 'workerAssignments', include: [{ model: Employee, as: 'worker', attributes: ['id', 'name'] }] }
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
    let { orderItemId, productModelId, notes, startDate, tasks, quantity } = req.body;
    if (orderItemId === '') orderItemId = null;
    if (productModelId === '') productModelId = null;
    if (!orderItemId && !productModelId) {
      await t.rollback();
      return res.status(400).json({ error: 'Order Item ID or Product Model ID is required.' });
    }

    let basePrice = null;
    let finalQuantity = quantity || 1;
    let orderId = null;

    if (orderItemId) {
      const { OrderItem } = require('../models');
      const item = await OrderItem.findByPk(orderItemId, { transaction: t });
      if (item) {
        if (item.status === 'pending') {
          await item.update({ status: 'in_production' }, { transaction: t });
        }
        basePrice = item.unitPrice; 
        finalQuantity = item.quantity;
        orderId = item.orderId;
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

    // 1. Create ONE Production Record
    const production = await Production.create({
       orderId,
       orderItemId,
       productModelId,
       stage: assignments[0]?.stage || 'fabrication', // Use first stage as fallback
       worker: assignments.map(a => a.workerName || a.worker || '').filter(Boolean).join(', '), // Comma-separated names for backwards-compat!
       notes,
       startDate: startDate || new Date(),
       status: 'pending',
       materialsDeducted: false,
       basePrice: basePrice,
       quantity: finalQuantity,
       taskName: assignments[0]?.taskName || 'Fabrication'
    }, { transaction: t });

    // 2. Create Multiple ProductionWorker Records
    for (const task of assignments) {
       let commissionType = task.commissionType;
       let commissionValue = task.commissionValue;
       const workerId = task.completedById || task.workerId;
       
       if (workerId && (!commissionValue || commissionValue === 0)) {
          const { Employee } = require('../models');
          const emp = await Employee.findByPk(workerId, { transaction: t });
          if (emp) {
            commissionType = 'percentage';
            commissionValue = Number(emp.commissionRate || 0);
          }
       }

       if (workerId) {
         await ProductionWorker.create({
            productionId: production.id,
            workerId: workerId,
            commissionType: commissionType || 'percentage',
            commissionValue: commissionValue || 0
         }, { transaction: t });
       }
    }

    await t.commit();
    res.status(201).json(production);
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
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    
    if (!production) {
      await t.rollback();
      return res.status(404).json({ error: 'Production record not found.' });
    }

    if (production.orderItemId) {
      production.orderItem = await OrderItem.findByPk(production.orderItemId, { transaction: t });
    }

    const newStatus = req.body.status;
    const needsDeduction = !production.materialsDeducted && 
      (newStatus === 'in_progress' || newStatus === 'completed') &&
      production.status !== newStatus;

    // Deduct materials when moving to in_progress or completed
    if (needsDeduction) {
      let qty = 1;
      if (production.orderItem) qty = production.orderItem.quantity;
      try {
        const deducted = await deductMaterials(production.orderItemId, production.productModelId, qty, t);
        req.body.materialsDeducted = deducted;
        // Convert reservations from 'reserved' to 'deducted' since actual stock is now reduced
        if (deducted && production.orderItem?.orderId) {
          await MaterialReservation.update(
            { status: 'deducted' },
            { where: { orderId: production.orderItem.orderId, status: 'reserved' }, transaction: t }
          );
        }
      } catch (err) {
        await t.rollback();
        return res.status(400).json({ error: err.message });
      }
    }

    // If completing, mark order as ready OR increment Model Stock
    if (newStatus === 'completed' && production.status !== 'completed') {
      if (production.orderItemId) {
         // Check if all production tasks for this OrderItem are complete
         const { Op } = require('sequelize');
         const otherTasksCount = await Production.count({
           where: {
             orderItemId: production.orderItemId,
             id: { [Op.ne]: production.id },
             status: { [Op.ne]: 'completed' }
           },
           transaction: t
         });

         if (otherTasksCount === 0) {
            const lockedItem = await OrderItem.findByPk(production.orderItemId, { transaction: t, lock: t.LOCK.UPDATE });
            if (lockedItem) await lockedItem.update({ status: 'ready' }, { transaction: t });
            
            // Check if all other items for this Order are also ready
            const itemOrderId = production.orderItem ? production.orderItem.orderId : (await OrderItem.findByPk(production.orderItemId, { transaction: t }))?.orderId;
            const parentOrder = await Order.findByPk(itemOrderId, {
              transaction: t,
              lock: t.LOCK.UPDATE
            });
            
            if (parentOrder) {
              parentOrder.items = await OrderItem.findAll({ where: { orderId: itemOrderId }, transaction: t });
              if (parentOrder.items.every(item => item.id === production.orderItemId || item.status === 'ready')) {
                await parentOrder.update({ status: 'ready' }, { transaction: t });
              }
            }
         }
      } else if (production.productModelId) {
        const model = await ProductModel.findByPk(production.productModelId, { transaction: t, lock: t.LOCK.UPDATE });
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
const revertMaterials = async (orderItemId, productModelId, targetQuantity, t) => {
  const { ProductModel, Material } = require('../models');
  let targetModel = null;

  if (orderItemId) {
    const { OrderItem } = require('../models');
    const item = await OrderItem.findByPk(orderItemId, { transaction: t });
    if (item) {
      targetModel = await ProductModel.findOne({ where: { name: item.sofaModel }, transaction: t });
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
      const lockedMat = await Material.findByPk(material.id, { transaction: t, lock: t.LOCK.UPDATE });
      if (lockedMat) await lockedMat.update({ stock: Number(lockedMat.stock) + requiredQty }, { transaction: t });
    }
  }
};

// DELETE /api/production/:id
router.delete('/:id', authenticate, authorize('admin', 'production', 'gerant'), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const production = await Production.findByPk(req.params.id, {
      include: [{ model: OrderItem, as: 'orderItem' }],
      transaction: t
    });
    if (!production) {
      await t.rollback();
      return res.status(404).json({ error: 'Production record not found.' });
    }

    // If materials were deducted, revert them
    if (production.materialsDeducted) {
      let qty = 1;
      if (production.orderItem) qty = production.orderItem.quantity;
      await revertMaterials(production.orderItemId, production.productModelId, qty, t);
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
