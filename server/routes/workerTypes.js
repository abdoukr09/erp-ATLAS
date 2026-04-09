const express = require('express');
const { WorkerType, WorkerTypeTariff, ProductModel } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

// GET /api/worker-types — list all types (with tariffs)
router.get('/', authenticate, async (req, res) => {
  try {
    const types = await WorkerType.findAll({
      include: [{
        model: WorkerTypeTariff,
        as: 'tariffs',
        include: [{ model: ProductModel, as: 'productModel', attributes: ['id', 'name', 'basePrice'] }]
      }],
      order: [['name', 'ASC']],
    });
    res.json(types);
  } catch (error) {
    console.error('Get WorkerTypes Error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/worker-types — create type (admin only)
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Le nom est requis.' });

    const existing = await WorkerType.findOne({ where: { name: name.trim() } });
    if (existing) return res.status(400).json({ error: 'Ce type existe déjà.' });

    const type = await WorkerType.create({ name: name.trim() });
    res.status(201).json(type);
  } catch (error) {
    console.error('Create WorkerType Error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /api/worker-types/:id — rename type (admin only)
router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const type = await WorkerType.findByPk(req.params.id);
    if (!type) return res.status(404).json({ error: 'Type non trouvé.' });

    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Le nom est requis.' });

    await type.update({ name: name.trim() });
    res.json(type);
  } catch (error) {
    console.error('Update WorkerType Error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/worker-types/:id — delete type (admin only)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const type = await WorkerType.findByPk(req.params.id);
    if (!type) return res.status(404).json({ error: 'Type non trouvé.' });

    await type.destroy();
    res.json({ message: 'Type supprimé.' });
  } catch (error) {
    console.error('Delete WorkerType Error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/worker-types/:id/tariffs — set tariff for a (type, product) pair (admin only)
router.post('/:id/tariffs', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { productModelId, paymentType, amount } = req.body;
    if (!productModelId) return res.status(400).json({ error: 'Le modèle produit est requis.' });

    // Upsert: if tariff already exists for this pair, update it
    const [tariff, created] = await WorkerTypeTariff.findOrCreate({
      where: { workerTypeId: req.params.id, productModelId },
      defaults: { paymentType: paymentType || 'fixed', amount: amount || 0 }
    });

    if (!created) {
      await tariff.update({ paymentType: paymentType || 'fixed', amount: amount || 0 });
    }

    // Re-fetch with association
    const full = await WorkerTypeTariff.findByPk(tariff.id, {
      include: [{ model: ProductModel, as: 'productModel', attributes: ['id', 'name', 'basePrice'] }]
    });

    res.status(created ? 201 : 200).json(full);
  } catch (error) {
    console.error('Create Tariff Error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /api/worker-types/tariffs/:tariffId — update tariff (admin only)
router.put('/tariffs/:tariffId', authenticate, authorize('admin'), async (req, res) => {
  try {
    const tariff = await WorkerTypeTariff.findByPk(req.params.tariffId);
    if (!tariff) return res.status(404).json({ error: 'Tarif non trouvé.' });

    const { paymentType, amount } = req.body;
    await tariff.update({
      paymentType: paymentType || tariff.paymentType,
      amount: amount !== undefined ? amount : tariff.amount
    });

    const full = await WorkerTypeTariff.findByPk(tariff.id, {
      include: [{ model: ProductModel, as: 'productModel', attributes: ['id', 'name', 'basePrice'] }]
    });

    res.json(full);
  } catch (error) {
    console.error('Update Tariff Error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/worker-types/tariffs/:tariffId — delete tariff (admin only)
router.delete('/tariffs/:tariffId', authenticate, authorize('admin'), async (req, res) => {
  try {
    const tariff = await WorkerTypeTariff.findByPk(req.params.tariffId);
    if (!tariff) return res.status(404).json({ error: 'Tarif non trouvé.' });

    await tariff.destroy();
    res.json({ message: 'Tarif supprimé.' });
  } catch (error) {
    console.error('Delete Tariff Error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
