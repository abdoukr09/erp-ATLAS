const express = require('express');
const { Order, Customer, Payment, Production, Delivery, OrderItem, OrderSalesman, Employee, ProductModel, Material, ModelMaterial, MaterialReservation } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimiter');
const { validate, schemas } = require('../middleware/validate');
const router = express.Router();

// GET /api/orders - Restricted roles + Field-level filtering for least privilege
router.get('/', authenticate, authorize('admin', 'sales', 'gerant', 'production', 'delivery'), async (req, res) => {
  try {
    const isFullAccess = ['admin', 'sales', 'gerant'].includes(req.user.role);
    
    // Define attributes based on role
    const orderAttributes = isFullAccess 
      ? undefined // Include all
      : ['id', 'customerId', 'deliveryAddress', 'notes', 'orderDate', 'status', 'createdAt'];

    const orders = await Order.findAll({
      attributes: orderAttributes,
      include: [
        { 
          model: Customer, as: 'customer', 
          attributes: isFullAccess ? ['id', 'name', 'phone', 'address'] : ['id', 'name', 'address'] 
        },
        ...(isFullAccess ? [{ model: Payment, as: 'payments', attributes: ['id', 'amount', 'status', 'method'] }] : []),
        { model: OrderItem, as: 'items' },
        { model: OrderSalesman, as: 'salesmen', include: [{ model: Employee, as: 'salesman', attributes: ['name'] }] }
      ],
      order: [['createdAt', 'DESC']],
    });
    res.json(orders);
  } catch (error) {
    console.error('Get Orders Error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/orders/:id
router.get('/:id', authenticate, authorize('admin', 'sales', 'gerant'), async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id, {
      include: [
        { model: Customer, as: 'customer' },
        { model: Payment, as: 'payments' },
        { model: OrderItem, as: 'items' },
        { model: OrderSalesman, as: 'salesmen', include: [{ model: Employee, as: 'salesman', attributes: ['name'] }] }
      ],
    });
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/orders — Rate limited + validated
router.post('/', authenticate, authorize('admin', 'sales', 'gerant'), writeLimiter, validate(schemas.createOrder), async (req, res) => {
  const t = await Order.sequelize.transaction();
  try {
    const { 
      customerId, items, salesmen, 
      deliveryAddress, notes, orderDate, discountPercentage, useStock, 
      advancePayment, paymentMethod 
    } = req.body;
    
    if (!customerId || !items || !Array.isArray(items) || items.length === 0) {
      await t.rollback();
      return res.status(400).json({ error: 'Client et au moins un article sont requis.' });
    }

    const customer = await Customer.findByPk(customerId, { transaction: t });
    if (!customer) { await t.rollback(); return res.status(404).json({ error: 'Client non trouvé.' }); }

    let computedTotal = 0;
    for (const item of items) {
      const qty = item.quantity || 1;
      const price = item.unitPrice || 0;
      const disc = item.discountPercentage || 0;
      computedTotal += qty * price * (1 - disc / 100);
    }
    const finalPrice = req.body.totalPrice !== undefined ? req.body.totalPrice : Math.round(computedTotal);

    const advanceAmount = advancePayment || 0;
    const order = await Order.create({
      customerId,
      totalPrice: finalPrice,
      advancePayment: advanceAmount,
      remainingPayment: finalPrice - advanceAmount,
      paymentStatus: advanceAmount >= finalPrice ? 'fully_paid' : (advanceAmount > 0 ? 'advance_paid' : 'unpaid'),
      deliveryAddress: deliveryAddress || customer.address,
      notes, orderDate: orderDate || new Date(),
      status: 'pending'
    }, { transaction: t });

    for (const item of items) {
       await OrderItem.create({
         orderId: order.id,
         sofaModel: item.sofaModel,
         quantity: item.quantity || 1,
         unitPrice: item.unitPrice || 0,
         discountPercentage: item.discountPercentage || 0,
         fabric: item.fabric || '',
         color: item.color || '',
         status: 'pending'
       }, { transaction: t });
    }

    // ── Material Reservation & Stock Deduction ────────────────────────────
    const reservationWarnings = [];
    for (const item of items) {
      const dbItem = await OrderItem.findOne({ 
        where: { orderId: order.id, sofaModel: item.sofaModel, status: 'pending' },
        transaction: t 
      });
      if (!dbItem) continue;

      const model = await ProductModel.findOne({ where: { name: item.sofaModel }, transaction: t });
      if (!model) continue;

      // ATOMIC STOCK FILL: Check if we can take from finished stock first
      if (useStock && Number(model.stock) >= Number(item.quantity || 1)) {
        await model.update({ stock: Number(model.stock) - Number(item.quantity || 1) }, { transaction: t });
        await dbItem.update({ status: 'ready' }, { transaction: t });
        // Create a dummy completed production record for tracking
        await Production.create({
          orderId: order.id,
          orderItemId: dbItem.id,
          productModelId: model.id,
          status: 'completed',
          notes: 'Fidélisation automatique via stock prêt.',
          completionDate: new Date()
        }, { transaction: t });
        continue; // Skip material reservation for this item
      }

      const bomEntries = await ModelMaterial.findAll({ where: { modelId: model.id }, transaction: t });
      for (const bom of bomEntries) {
        const qty = (item.quantity || 1) * Number(bom.quantity);
        const material = await Material.findByPk(bom.materialId, { transaction: t, lock: t.LOCK.UPDATE });
        if (!material) continue;

        const alreadyReserved = await MaterialReservation.sum('quantity', {
          where: { materialId: bom.materialId, status: 'reserved' },
          transaction: t
        }) || 0;
        const available = Number(material.stock || 0) - alreadyReserved;

        if (available < qty) {
          reservationWarnings.push(`${material.name}: besoin ${qty}, disponible ${available.toFixed(1)}`);
        }

        await MaterialReservation.create({
          orderId: order.id,
          materialId: bom.materialId,
          quantity: qty,
          status: 'reserved'
        }, { transaction: t });
      }
    }

    if (salesmen && Array.isArray(salesmen) && salesmen.length > 0) {
       for (const s of salesmen) {
          await OrderSalesman.create({
            orderId: order.id,
            salesmanId: s.salesmanId,
            splitPercentage: s.splitPercentage || (100 / salesmen.length)
          }, { transaction: t });
       }
    } else if (req.body.salesmanId) {
       await OrderSalesman.create({
         orderId: order.id,
         salesmanId: req.body.salesmanId,
         splitPercentage: 100.00
       }, { transaction: t });
    }

    if (advanceAmount > 0) {
      await Payment.create({
        orderId: order.id,
        amount: advanceAmount,
        method: paymentMethod || 'cash',
        status: 'completed',
        type: 'advance',
        notes: 'Avance à la commande',
      }, { transaction: t });
    }

    await t.commit();
    const response = order.toJSON();
    if (reservationWarnings.length > 0) response.reservationWarnings = reservationWarnings;
    res.status(201).json(response);
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// PUT /api/orders/:id
router.put('/:id', authenticate, authorize('admin', 'sales', 'gerant'), validate(schemas.updateOrder), async (req, res) => {
  const t = await Order.sequelize.transaction();
  try {
    const order = await Order.findByPk(req.params.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!order) {
      await t.rollback();
      return res.status(404).json({ error: 'Order not found.' });
    }

    const wasDelivered = order.status === 'delivered';
    const willBeDelivered = req.body.status === 'delivered';
    const wasCancelled = order.status === 'cancelled';
    const willBeCancelled = req.body.status === 'cancelled';

    if (!wasCancelled && willBeCancelled) {
      const productions = await Production.findAll({
        where: { orderId: order.id },
        include: [{ model: OrderItem, as: 'orderItem' }],
        transaction: t
      });
      for (const prod of productions) {
        if (prod.status === 'cancelled') continue;
        
        const qty = prod.orderItem ? prod.orderItem.quantity : 1;
        const targetModel = prod.orderItem
          ? await ProductModel.findOne({ where: { name: prod.orderItem.sofaModel }, transaction: t })
          : (prod.productModelId ? await ProductModel.findByPk(prod.productModelId, { transaction: t }) : null);

        if (prod.status === 'completed' || prod.status === 'delivered') {
          // Finished Product: goes to ProductModels stock
          if (targetModel) {
            await targetModel.update({ stock: Number(targetModel.stock) + qty }, { transaction: t });
          }
        } else if (prod.materialsDeducted) {
          // Unfinished Product: restore Raw Materials
          if (targetModel) {
            const bomEntries = await ModelMaterial.findAll({ where: { modelId: targetModel.id }, transaction: t });
            for (const bom of bomEntries) {
              const revertQty = Number(bom.quantity) * qty;
              const mat = await Material.findByPk(bom.materialId, { transaction: t, lock: t.LOCK.UPDATE });
              if (mat) await mat.update({ stock: Number(mat.stock) + revertQty }, { transaction: t });
            }
          }
          await prod.update({ status: 'cancelled', materialsDeducted: false }, { transaction: t });
        } else {
          await prod.update({ status: 'cancelled' }, { transaction: t });
        }
        
        if (prod.orderItem) {
          await prod.orderItem.update({ status: 'cancelled' }, { transaction: t });
        }
      }
      // Release any pending material reservations
      await MaterialReservation.destroy({ where: { orderId: order.id, status: 'reserved' }, transaction: t });
    }

    // Recalculate Total Price based on sub-items if passed
    if (req.body.items && Array.isArray(req.body.items)) {
      let computedTotal = 0;
      for (const item of req.body.items) {
        if (item.id) {
          const existingItem = await OrderItem.findByPk(item.id, { transaction: t });
          if (existingItem && existingItem.orderId === order.id) {
            const qty = item.quantity !== undefined ? item.quantity : existingItem.quantity;
            const price = item.unitPrice !== undefined ? item.unitPrice : existingItem.unitPrice;
            const disc = item.discountPercentage !== undefined ? item.discountPercentage : (existingItem.discountPercentage || 0);

            await existingItem.update({
              sofaModel: item.sofaModel !== undefined ? item.sofaModel : existingItem.sofaModel,
              quantity: qty,
              unitPrice: price,
              discountPercentage: disc,
              fabric: item.fabric !== undefined ? item.fabric : existingItem.fabric,
              color: item.color !== undefined ? item.color : existingItem.color,
              status: item.status !== undefined ? item.status : existingItem.status,
            }, { transaction: t });
            computedTotal += qty * price * (1 - disc / 100);
          }
        } else {
          await OrderItem.create({
            orderId: order.id,
            sofaModel: item.sofaModel,
            quantity: item.quantity || 1,
            unitPrice: item.unitPrice || 0,
            discountPercentage: item.discountPercentage || 0,
            fabric: item.fabric || '',
            color: item.color || '',
            status: 'pending'
          }, { transaction: t });
          computedTotal += (item.quantity || 1) * (item.unitPrice || 0) * (1 - (item.discountPercentage || 0) / 100);
        }
      }
      req.body.totalPrice = Math.round(computedTotal);
    }

    if (req.body.salesmen && Array.isArray(req.body.salesmen)) {
       await OrderSalesman.destroy({ where: { orderId: order.id }, transaction: t });
       for (const s of req.body.salesmen) {
          await OrderSalesman.create({
            orderId: order.id,
            salesmanId: s.salesmanId,
            splitPercentage: s.splitPercentage || (100 / req.body.salesmen.length)
          }, { transaction: t });
       }
    }

    // ── Persistent "Take from Stock" logic for Updates ───────────────────
    if (req.body.useStock === true) {
      const pendingItems = await OrderItem.findAll({ 
        where: { orderId: order.id, status: 'pending' },
        transaction: t 
      });

      for (const item of pendingItems) {
        const model = await ProductModel.findOne({ where: { name: item.sofaModel }, transaction: t });
        if (model && Number(model.stock) >= Number(item.quantity)) {
          // Deduct from finished stock
          await model.update({ stock: Number(model.stock) - Number(item.quantity) }, { transaction: t });
          await item.update({ status: 'ready' }, { transaction: t });
          
          // Clear material reservations for this order (partial or full)
          // Since reservations are per-order, we'll recalculate or simply delete 
          // reservations for the specific materials of THIS model item.
          const bom = await ModelMaterial.findAll({ where: { modelId: model.id }, transaction: t });
          for (const entry of bom) {
             const qtyToDrop = Number(entry.quantity) * Number(item.quantity);
             const reservation = await MaterialReservation.findOne({
               where: { orderId: order.id, materialId: entry.materialId, status: 'reserved' },
               transaction: t
             });
             if (reservation) {
                if (Number(reservation.quantity) <= qtyToDrop) {
                  await reservation.destroy({ transaction: t });
                } else {
                  await reservation.update({ quantity: Number(reservation.quantity) - qtyToDrop }, { transaction: t });
                }
             }
          }

          // Create/ensure completed production record
          await Production.create({
            orderId: order.id,
            orderItemId: item.id,
            productModelId: model.id,
            status: 'completed',
            notes: 'Rempli manuellement via stock lors de la modification.',
            completionDate: new Date()
          }, { transaction: t });
        }
      }
    }

    if (req.body.totalPrice !== undefined) {
      const totalPaid = await Payment.sum('amount', { where: { orderId: order.id, status: 'completed' }, transaction: t }) || 0;
      req.body.remainingPayment = req.body.totalPrice - totalPaid;
      req.body.paymentStatus = req.body.remainingPayment <= 0 ? 'fully_paid' : (totalPaid > 0 ? 'advance_paid' : 'unpaid');
    }

    // Automatic Payment on Delivery update
    if (!wasDelivered && willBeDelivered) {
      const totalPaid = await Payment.sum('amount', { 
        where: { orderId: order.id, status: 'completed' },
        transaction: t 
      }) || 0;
      const currentTotal = req.body.totalPrice !== undefined ? req.body.totalPrice : order.totalPrice;
      const remainingAmount = Math.max(0, Number(currentTotal) - totalPaid);

      if (remainingAmount > 0) {
        await Payment.create({
          orderId: order.id,
          amount: remainingAmount,
          method: req.body.paymentMethod || 'cash',
          status: 'completed',
          type: 'final',
          paymentDate: new Date(),
          notes: 'Paiement final automatique à la livraison',
        }, { transaction: t });
      }
      req.body.remainingPayment = 0;
      req.body.paymentStatus = 'fully_paid';
    }

    // Allow updating commission terms
    if (req.body.commissionType !== undefined) req.body.commissionType = req.body.commissionType;
    if (req.body.commissionValue !== undefined) req.body.commissionValue = req.body.commissionValue;

    await order.update(req.body, { transaction: t });
    await t.commit();
    res.json(order);
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error('Update Order Error:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// DELETE /api/orders/:id
router.delete('/:id', authenticate, authorize('admin', 'sales', 'gerant'), async (req, res) => {
  const t = await Order.sequelize.transaction();
  try {
    const order = await Order.findByPk(req.params.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!order) {
      await t.rollback();
      return res.status(404).json({ error: 'Order not found.' });
    }

    // Manually cascade delete since DB constraints might not be in sync
    // Revert physical stock for any production that already deducted materials
    const productions = await Production.findAll({
      where: { orderId: order.id },
      include: [{ model: OrderItem, as: 'orderItem' }],
      transaction: t
    });
    for (const prod of productions) {
      if (prod.status === 'cancelled') continue; // If already cancelled, stock was handled
      
      const qty = prod.orderItem ? prod.orderItem.quantity : 1;
      const targetModel = prod.orderItem
        ? await ProductModel.findOne({ where: { name: prod.orderItem.sofaModel }, transaction: t })
        : (prod.productModelId ? await ProductModel.findByPk(prod.productModelId, { transaction: t }) : null);

      if (prod.status === 'completed' || prod.status === 'delivered') {
        // Product was finished before deletion. Protect finished inventory.
        if (targetModel) {
          await targetModel.update({ stock: Number(targetModel.stock) + qty }, { transaction: t });
        }
      } else if (prod.materialsDeducted) {
        // Product was unfinished but materials deducted. Revert raw materials.
        if (targetModel) {
          const bomEntries = await ModelMaterial.findAll({ where: { modelId: targetModel.id }, transaction: t });
          for (const bom of bomEntries) {
            const revertQty = Number(bom.quantity) * qty;
            const mat = await Material.findByPk(bom.materialId, { transaction: t, lock: t.LOCK.UPDATE });
            if (mat) await mat.update({ stock: Number(mat.stock) + revertQty }, { transaction: t });
          }
        }
      }
    }
    await MaterialReservation.destroy({ where: { orderId: order.id }, transaction: t });
    await Production.destroy({ where: { orderId: order.id }, transaction: t });
    await Delivery.destroy({ where: { orderId: order.id }, transaction: t });
    await Payment.destroy({ where: { orderId: order.id }, transaction: t });
    await OrderItem.destroy({ where: { orderId: order.id }, transaction: t });
    await OrderSalesman.destroy({ where: { orderId: order.id }, transaction: t });

    await order.destroy({ transaction: t });
    await t.commit();
    res.json({ message: 'Order deleted.' });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error('Delete Order Error:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

module.exports = router;
