const express = require('express');
const { Order, Customer, Payment, Production, Delivery } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

// GET /api/orders
router.get('/', authenticate, async (req, res) => {
  try {
    const orders = await Order.findAll({
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] },
        { model: Payment, as: 'payments', attributes: ['id', 'amount', 'status', 'method'] },
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
  try {
    const { customerId, sofaModel, fabric, color, quantity, unitPrice, deliveryAddress, notes, orderDate, discountPercentage, useStock } = req.body;
    
    if (!customerId || !sofaModel) {
      return res.status(400).json({ error: 'Customer and sofa model are required.' });
    }

    const customer = await Customer.findByPk(customerId);
    if (!customer) return res.status(404).json({ error: 'Customer not found.' });

    const subtotal = (quantity || 1) * (unitPrice || 0);
    const discount = subtotal * ((discountPercentage || 0) / 100);
    const totalPrice = req.body.totalPrice !== undefined ? req.body.totalPrice : (subtotal - discount);

    let initialStatus = 'pending';
    if (useStock) {
      const { ProductModel } = require('../models');
      const model = await ProductModel.findOne({ where: { name: sofaModel } });
      if (model && model.stock >= (quantity || 1)) {
        await model.update({ stock: model.stock - (quantity || 1) });
        initialStatus = 'ready';
      } else {
        return res.status(400).json({ error: 'Stock insuffisant pour remplir cette commande directement.' });
      }
    }

    const advanceAmount = req.body.advancePayment || 0;
    const order = await Order.create({
      customerId, sofaModel, fabric, color,
      quantity: quantity || 1,
      unitPrice: unitPrice || 0,
      discountPercentage: discountPercentage || 0,
      totalPrice,
      advancePayment: advanceAmount,
      paymentStatus: advanceAmount > 0 ? 'advance_paid' : 'unpaid',
      deliveryAddress: deliveryAddress || customer.address,
      notes, orderDate: orderDate || new Date(),
      status: initialStatus,
    });

    if (advanceAmount > 0) {
      await Payment.create({
        orderId: order.id,
        amount: advanceAmount,
        method: req.body.paymentMethod || 'cash',
        status: 'completed',
        type: 'advance',
        notes: 'Avance à la commande',
      });
    }

    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /api/orders/:id
router.put('/:id', authenticate, authorize('admin', 'sales', 'gerant'), async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    if (req.body.totalPrice !== undefined) {
      req.body.totalPrice = req.body.totalPrice;
    } else if (req.body.quantity !== undefined || req.body.unitPrice !== undefined || req.body.discountPercentage !== undefined) {
      const qty = req.body.quantity !== undefined ? req.body.quantity : order.quantity;
      const price = req.body.unitPrice !== undefined ? req.body.unitPrice : order.unitPrice;
      const disc = req.body.discountPercentage !== undefined ? req.body.discountPercentage : order.discountPercentage;
      
      const subtotal = qty * price;
      const discount = subtotal * (disc / 100);
      req.body.totalPrice = subtotal - discount;
    }

    if (req.body.advancePayment !== undefined) {
      req.body.advancePayment = req.body.advancePayment;
    }

    await order.update(req.body);
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/orders/:id
router.delete('/:id', authenticate, authorize('admin', 'sales', 'gerant'), async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    // Manually cascade delete since DB constraints might not be in sync
    await Production.destroy({ where: { orderId: order.id } });
    await Delivery.destroy({ where: { orderId: order.id } });
    await Payment.destroy({ where: { orderId: order.id } });

    await order.destroy();
    res.json({ message: 'Order deleted.' });
  } catch (error) {
    console.error('Delete Order Error:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

module.exports = router;
