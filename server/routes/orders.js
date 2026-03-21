const express = require('express');
const { Order, Customer, Payment, Production, Delivery, OrderItem, OrderSalesman, Employee, ProductModel, Material, ModelMaterial, MaterialReservation } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

// GET /api/orders
router.get('/', authenticate, async (req, res) => {
  try {
    const orders = await Order.findAll({
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] },
        { model: Payment, as: 'payments', attributes: ['id', 'amount', 'status', 'method'] },
        { model: OrderItem, as: 'items' },
        { model: OrderSalesman, as: 'salesmen', include: [{ model: Employee, as: 'salesman', attributes: ['name'] }] }
      ],
      order: [['createdAt', 'DESC']],
    });
    res.json(orders);
  } catch (error) {
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

// POST /api/orders
router.post('/', authenticate, authorize('admin', 'sales', 'gerant'), async (req, res) => {
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

    // ── Material Reservation: lock materials, check availability, reserve ──
    const reservationWarnings = [];
    for (const item of items) {
      const model = await ProductModel.findOne({ where: { name: item.sofaModel }, transaction: t });
      if (!model) continue;

      const bomEntries = await ModelMaterial.findAll({ where: { modelId: model.id }, transaction: t });
      for (const bom of bomEntries) {
        const qty = (item.quantity || 1) * Number(bom.quantity);
        // Lock material row to prevent concurrent reads of stale stock
        const material = await Material.findByPk(bom.materialId, { transaction: t, lock: t.LOCK.UPDATE });
        if (!material) continue;

        // Calculate available = physical stock - already reserved by other orders
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
router.put('/:id', authenticate, authorize('admin', 'sales', 'gerant'), async (req, res) => {
  const t = await Order.sequelize.transaction();
  try {
    const order = await Order.findByPk(req.params.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!order) {
      await t.rollback();
      return res.status(404).json({ error: 'Order not found.' });
    }

    const wasDelivered = order.status === 'delivered';
    const willBeDelivered = req.body.status === 'delivered';

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
      if (prod.materialsDeducted) {
        const qty = prod.orderItem ? prod.orderItem.quantity : 1;
        // Revert: lock each material row and restore stock
        const targetModel = prod.orderItem
          ? await ProductModel.findOne({ where: { name: prod.orderItem.sofaModel }, transaction: t })
          : (prod.productModelId ? await ProductModel.findByPk(prod.productModelId, { transaction: t }) : null);

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
