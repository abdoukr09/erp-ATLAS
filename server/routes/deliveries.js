const express = require('express');
const { Delivery, Order, Payment } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

// GET /api/deliveries
router.get('/', authenticate, authorize('admin', 'delivery', 'gerant'), async (req, res) => {
  try {
    const deliveries = await Delivery.findAll({
      include: [{ model: Order, as: 'order', attributes: ['id', 'sofaModel', 'quantity', 'status', 'totalPrice', 'advancePayment', 'remainingPayment', 'paymentStatus', 'deliveryAddress'] }],
      order: [['createdAt', 'DESC']],
    });
    res.json(deliveries);
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/deliveries
router.post('/', authenticate, authorize('admin', 'delivery', 'gerant'), async (req, res) => {
  try {
    const { orderId, driver, deliveryDate, address, notes } = req.body;
    if (!orderId) return res.status(400).json({ error: 'Order ID is required.' });

    const order = await Order.findByPk(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    const delivery = await Delivery.create({
      orderId, driver, deliveryDate,
      address: address || order.deliveryAddress,
      notes,
    });
    res.status(201).json(delivery);
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /api/deliveries/:id
router.put('/:id', authenticate, authorize('admin', 'delivery', 'gerant'), async (req, res) => {
  const t = await Delivery.sequelize.transaction();
  try {
    if (req.body.orderId === '') req.body.orderId = null;
    const delivery = await Delivery.findByPk(req.params.id, {
      include: [{ model: Order, as: 'order' }],
      transaction: t
    });
    if (!delivery) {
      await t.rollback();
      return res.status(404).json({ error: 'Delivery not found.' });
    }

    const newStatus = req.body.status;
    const wasDelivered = delivery.status === 'delivered';
    const willBeDelivered = newStatus === 'delivered';

    if (delivery.order) {
      // Changing FROM delivered → something else: reverse the final payment
      if (wasDelivered && !willBeDelivered) {
        await Payment.destroy({
          where: { orderId: delivery.order.id, type: 'final' },
          transaction: t,
        });
        const hadAdvance = Number(delivery.order.advancePayment) > 0;
        await delivery.order.update({
          status: 'ready',
          remainingPayment: 0,
          paymentStatus: hadAdvance ? 'advance_paid' : 'unpaid',
        }, { transaction: t });
      }

      // Changing TO delivered (and wasn't before): create the final payment
      if (!wasDelivered && willBeDelivered) {
        const remainingAmount = Math.max(0, Number(delivery.order.totalPrice) - Number(delivery.order.advancePayment));

        // Remove any accidental duplicates first
        await Payment.destroy({
          where: { orderId: delivery.order.id, type: 'final' },
          transaction: t,
        });

        if (remainingAmount > 0) {
          await Payment.create({
            orderId: delivery.order.id,
            amount: remainingAmount,
            method: req.body.paymentMethod || 'cash',
            status: 'completed',
            type: 'final',
            paymentDate: new Date(),
            notes: 'Paiement final à la livraison',
          }, { transaction: t });
        }

        await delivery.order.update({
          status: 'delivered',
          remainingPayment: remainingAmount,
          paymentStatus: 'fully_paid',
        }, { transaction: t });
      }
    }

    await delivery.update(req.body, { transaction: t });
    await t.commit();
    res.json(delivery);
  } catch (error) {
    await t.rollback();
    console.error('Update Delivery Error:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// POST /api/deliveries/:id/confirm - Confirm delivery & record final payment
router.post('/:id/confirm', authenticate, authorize('admin', 'delivery', 'gerant'), async (req, res) => {
  const t = await Delivery.sequelize.transaction();
  try {
    const delivery = await Delivery.findByPk(req.params.id, {
      include: [{ model: Order, as: 'order' }],
      transaction: t,
    });
    if (!delivery) {
      await t.rollback();
      return res.status(404).json({ error: 'Livraison introuvable.' });
    }
    if (delivery.status === 'delivered') {
      await t.rollback();
      return res.status(400).json({ error: 'Cette livraison est déjà confirmée.' });
    }
    if (!delivery.order) {
      await t.rollback();
      return res.status(400).json({ error: 'Aucune commande associée à cette livraison.' });
    }

    const order = delivery.order;
    const remainingAmount = Math.max(0, Number(order.totalPrice) - Number(order.advancePayment));

    // 1. Mark delivery as delivered
    await delivery.update({ status: 'delivered', deliveryDate: delivery.deliveryDate || new Date() }, { transaction: t });

    // 2. Mark order as delivered
    await order.update({
      status: 'delivered',
      remainingPayment: remainingAmount,
      paymentStatus: 'fully_paid',
    }, { transaction: t });

    // 3. Create final payment record (only if there is a remaining balance)
    let finalPayment = null;
    if (remainingAmount > 0) {
      finalPayment = await Payment.create({
        orderId: order.id,
        amount: remainingAmount,
        method: req.body.paymentMethod || 'cash',
        status: 'completed',
        type: 'final',
        paymentDate: new Date(),
        notes: 'Paiement final à la livraison',
      }, { transaction: t });
    }

    await t.commit();

    res.json({
      message: 'Livraison confirmée et paiement final enregistré.',
      delivery,
      order,
      finalPayment,
      remainingAmount,
    });
  } catch (error) {
    await t.rollback();
    console.error('Confirm Delivery Error:', error);
    res.status(500).json({ error: 'Erreur serveur: ' + error.message });
  }
});

// DELETE /api/deliveries/:id
router.delete('/:id', authenticate, authorize('admin', 'delivery', 'gerant'), async (req, res) => {
  try {
    const delivery = await Delivery.findByPk(req.params.id);
    if (!delivery) return res.status(404).json({ error: 'Delivery not found.' });

    await delivery.destroy();
    res.json({ message: 'Delivery deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
