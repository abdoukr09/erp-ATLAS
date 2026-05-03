const express = require('express');
const { Location, LocationStock, ProductModel } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { Op } = require('sequelize');
const router = express.Router();

// GET all locations
router.get('/', authenticate, async (req, res) => {
  try {
    const locations = await Location.findAll({
      order: [['name', 'ASC']],
    });
    res.json(locations);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET stock for all locations
router.get('/stock', authenticate, async (req, res) => {
  try {
    const stocks = await LocationStock.findAll({
      include: [
        { model: Location, as: 'location', attributes: ['id', 'name', 'color'] },
        { model: ProductModel, as: 'productModel', attributes: ['id', 'name', 'category'] }
      ]
    });
    res.json(stocks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// CREATE a location
router.post('/', authenticate, authorize('admin', 'gerant'), async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required.' });

    const location = await Location.create({ name, color });
    res.status(201).json(location);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Location name already exists.' });
    }
    console.error(error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// UPDATE a location
router.put('/:id', authenticate, authorize('admin', 'gerant'), async (req, res) => {
  try {
    const { name, color } = req.body;
    const location = await Location.findByPk(req.params.id);
    if (!location) return res.status(404).json({ error: 'Location not found.' });

    await location.update({ name, color });
    res.json(location);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Location name already exists.' });
    }
    console.error(error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE a location
router.delete('/:id', authenticate, authorize('admin', 'gerant'), async (req, res) => {
  try {
    const location = await Location.findByPk(req.params.id);
    if (!location) return res.status(404).json({ error: 'Location not found.' });

    // Check if there is stock in this location
    const stockCount = await LocationStock.count({ where: { locationId: location.id, quantity: { [Op.gt]: 0 } } });
    if (stockCount > 0) {
      return res.status(400).json({ error: 'Cannot delete location with existing stock.' });
    }

    await location.destroy();
    res.json({ message: 'Location deleted successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
