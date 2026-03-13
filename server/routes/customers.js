const express = require('express');
const { Customer, Order } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

// GET /api/customers
router.get('/', authenticate, authorize('admin', 'sales', 'gerant'), async (req, res) => {
  try {
    const customers = await Customer.findAll({
      include: [{ model: Order, as: 'orders', attributes: ['id', 'status', 'totalPrice'] }],
      order: [['createdAt', 'DESC']],
    });
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/customers/:id
router.get('/:id', authenticate, authorize('admin', 'sales', 'gerant'), async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id, {
      include: [{ model: Order, as: 'orders' }],
    });
    if (!customer) return res.status(404).json({ error: 'Customer not found.' });
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/customers
router.post('/', authenticate, authorize('admin', 'sales', 'gerant'), async (req, res) => {
  try {
    const { name, phone, email, address, city, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required.' });

    const customer = await Customer.create({ name, phone, email, address, city, notes });
    res.status(201).json(customer);
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /api/customers/:id
router.put('/:id', authenticate, authorize('admin', 'sales', 'gerant'), async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found.' });

    await customer.update(req.body);
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/customers/:id
router.delete('/:id', authenticate, authorize('admin', 'sales', 'gerant'), async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found.' });

    await customer.destroy();
    res.json({ message: 'Customer deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
