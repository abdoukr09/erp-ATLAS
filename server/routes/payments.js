const express = require('express');
const { Payment, Order, Customer, OrderItem } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const sequelize = require('../config/database');
const { writeLimiter } = require('../middleware/rateLimiter');
const { validate, schemas } = require('../middleware/validate');
const router = express.Router();

// GET /api/payments
router.get('/', authenticate, authorize('admin', 'sales', 'gerant'), async (req, res) => {
  try {
    const payments = await Payment.findAll({
      include: [{
        model: Order, as: 'order',
        attributes: ['id', 'sofaModel', 'totalPrice', 'status'],
        include: [
          { model: Customer, as: 'customer', attributes: ['id', 'name'] },
          { model: OrderItem, as: 'items', attributes: ['sofaModel', 'quantity'] }
        ],
      }],
      order: [['createdAt', 'DESC']],
    });
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Helper to sync order payment status (MUST be called within a transaction)
const syncOrderPayment = async (orderId, t) => {
  const order = await Order.findByPk(orderId, { transaction: t, lock: t.LOCK.UPDATE });
  if (!order) return;

  const totalPaid = await Payment.sum('amount', { where: { orderId, status: 'completed' }, transaction: t }) || 0;
  const finalPaid = await Payment.sum('amount', { where: { orderId, status: 'completed', type: 'final' }, transaction: t }) || 0;
  const advancePaid = Math.max(0, totalPaid - finalPaid);
  
  const remaining = Math.max(0, Number(order.totalPrice) - totalPaid);
  let status = 'unpaid';
  if (remaining <= 0) status = 'fully_paid';
  else if (totalPaid > 0) status = 'advance_paid';

  await order.update({ 
    advancePayment: advancePaid,
    remainingPayment: remaining, 
    paymentStatus: status 
  }, { transaction: t });
};

// POST /api/payments — Rate limited + validated
router.post('/', authenticate, authorize('admin', 'sales', 'gerant'), writeLimiter, validate(schemas.createPayment), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { orderId, amount, method, paymentDate, notes, type } = req.body;
    if (type === 'final') {
      await t.rollback();
      return res.status(400).json({ error: "Le type 'final' est réservé au système automatique lors de la livraison. Utilisez 'advance' ou 'other'." });
    }

    if (!orderId || !amount) {
      await t.rollback();
      return res.status(400).json({ error: 'Order ID and amount are required.' });
    }

    const order = await Order.findByPk(orderId, { transaction: t });
    if (!order) {
      await t.rollback();
      return res.status(404).json({ error: 'Order not found.' });
    }

    const payment = await Payment.create({
      orderId, amount, method: method || 'cash',
      status: 'completed',
      paymentDate: paymentDate || new Date(),
      type: type || 'other',
      notes,
    }, { transaction: t });

    await syncOrderPayment(orderId, t);
    await t.commit();

    res.status(201).json(payment);
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error('Payment Create Error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /api/payments/:id
router.put('/:id', authenticate, authorize('admin', 'sales', 'gerant'), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const payment = await Payment.findByPk(req.params.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!payment) {
      await t.rollback();
      return res.status(404).json({ error: 'Payment not found.' });
    }

    if (req.body.type === 'final') {
      await t.rollback();
      return res.status(400).json({ error: "Modification en type 'final' interdite. Utilisez 'advance' ou 'other'." });
    }

    await payment.update(req.body, { transaction: t });
    await syncOrderPayment(payment.orderId, t);
    await t.commit();

    res.json(payment);
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/payments/:id
router.delete('/:id', authenticate, authorize('admin', 'sales', 'gerant'), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const payment = await Payment.findByPk(req.params.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!payment) {
      await t.rollback();
      return res.status(404).json({ error: 'Payment not found.' });
    }

    const orderId = payment.orderId;
    await payment.destroy({ transaction: t });
    await syncOrderPayment(orderId, t);
    await t.commit();

    res.json({ message: 'Payment deleted and order updated.' });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
