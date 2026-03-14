const express = require('express');
const { Payment, Order, Customer } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

// GET /api/payments
router.get('/', authenticate, authorize('admin', 'sales', 'gerant'), async (req, res) => {
  try {
    const payments = await Payment.findAll({
      include: [{
        model: Order, as: 'order',
        attributes: ['id', 'sofaModel', 'totalPrice', 'status'],
        include: [{ model: Customer, as: 'customer', attributes: ['id', 'name'] }],
      }],
      order: [['createdAt', 'DESC']],
    });
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// Helper to sync order payment status
const syncOrderPayment = async (orderId) => {
  const order = await Order.findByPk(orderId);
  if (!order) return;

  const totalPaid = await Payment.sum('amount', { where: { orderId, status: 'completed' } });
  const remaining = Number(order.totalPrice) - (totalPaid || 0);
  let status = 'unpaid';
  if (remaining <= 0) status = 'fully_paid';
  else if ((totalPaid || 0) > 0) status = 'advance_paid';

  await order.update({ remainingPayment: remaining, paymentStatus: status });
};

// POST /api/payments
router.post('/', authenticate, authorize('admin', 'sales', 'gerant'), async (req, res) => {
  try {
    const { orderId, amount, method, paymentDate, notes, type } = req.body;
    if (!orderId || !amount) return res.status(400).json({ error: 'Order ID and amount are required.' });

    const order = await Order.findByPk(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    const payment = await Payment.create({
      orderId, amount, method: method || 'cash',
      status: 'completed',
      paymentDate: paymentDate || new Date(),
      type: type || 'other',
      notes,
    });

    await syncOrderPayment(orderId);

    res.status(201).json(payment);
  } catch (error) {
    console.error('Payment Create Error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /api/payments/:id
router.put('/:id', authenticate, authorize('admin', 'sales', 'gerant'), async (req, res) => {
  try {
    const payment = await Payment.findByPk(req.params.id);
    if (!payment) return res.status(404).json({ error: 'Payment not found.' });

    await payment.update(req.body);
    await syncOrderPayment(payment.orderId);

    res.json(payment);
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/payments/:id
router.delete('/:id', authenticate, authorize('admin', 'sales', 'gerant'), async (req, res) => {
  try {
    const payment = await Payment.findByPk(req.params.id);
    if (!payment) return res.status(404).json({ error: 'Payment not found.' });

    const orderId = payment.orderId;
    await payment.destroy();
    await syncOrderPayment(orderId);

    res.json({ message: 'Payment deleted and order updated.' });
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
