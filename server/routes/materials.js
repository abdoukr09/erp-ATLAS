const express = require('express');
const { Material } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { Op } = require('sequelize');
const router = express.Router();

// GET /api/materials
router.get('/', authenticate, authorize('admin', 'production', 'gerant'), async (req, res) => {
  try {
    const materials = await Material.findAll({ order: [['name', 'ASC']] });
    res.json(materials);
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/materials/low-stock
router.get('/low-stock', authenticate, authorize('admin', 'production', 'gerant'), async (req, res) => {
  try {
    const allMaterials = await Material.findAll();
    const lowStock = allMaterials.filter(m => Number(m.stock) <= Number(m.minStock));
    res.json(lowStock);
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/materials
router.post('/', authenticate, authorize('admin', 'production', 'gerant'), async (req, res) => {
  try {
    const { name, category, stock, unit, minStock, price, supplier } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required.' });

    // barcode is filled by the trg_materials_barcode BEFORE INSERT trigger and comes
    // back through Sequelize's INSERT ... RETURNING *, so it is already set here
    const material = await Material.create({ name, category, stock, unit, minStock, price, supplier });
    res.status(201).json(material);
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /api/materials/:id
router.put('/:id', authenticate, authorize('admin', 'production', 'gerant'), async (req, res) => {
  try {
    const material = await Material.findByPk(req.params.id);
    if (!material) return res.status(404).json({ error: 'Material not found.' });

    await material.update(req.body);
    res.json(material);
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/materials/:id
router.delete('/:id', authenticate, authorize('admin', 'production', 'gerant'), async (req, res) => {
  try {
    const material = await Material.findByPk(req.params.id);
    if (!material) return res.status(404).json({ error: 'Material not found.' });

    await material.destroy();
    res.json({ message: 'Material deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
