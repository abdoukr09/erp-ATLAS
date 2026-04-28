const express = require('express');
const { DeliveryRoutePrime, Location, Delivery, Employee, DeliveryOrder, Order, Customer } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { Op } = require('sequelize');
const router = express.Router();

// GET /api/delivery-primes - List all route primes
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const primes = await DeliveryRoutePrime.findAll({
      include: [
        { model: Location, as: 'sourceLocation', attributes: ['id', 'name', 'color'] },
        { model: Location, as: 'destLocation', attributes: ['id', 'name', 'color'] },
      ],
      order: [['createdAt', 'DESC']],
    });
    res.json(primes);
  } catch (error) {
    console.error('Get Delivery Primes Error:', error);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// POST /api/delivery-primes - Create a route prime
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { sourceLocationId, destLocationId, destWilaya, prime, notes } = req.body;

    if (prime === undefined || prime === null || Number(prime) < 0) {
      return res.status(400).json({ error: 'Le montant de la prime est requis.' });
    }

    // Validate: either destLocationId or destWilaya, not both
    if (destLocationId && destWilaya) {
      return res.status(400).json({ error: 'Choisissez soit une destination (emplacement) soit une wilaya, pas les deux.' });
    }
    if (!destLocationId && !destWilaya) {
      return res.status(400).json({ error: 'Une destination est requise (emplacement ou wilaya).' });
    }

    const routePrime = await DeliveryRoutePrime.create({
      sourceLocationId: sourceLocationId || null,
      destLocationId: destLocationId || null,
      destWilaya: destWilaya || null,
      prime,
      notes,
    });

    // Reload with associations
    const full = await DeliveryRoutePrime.findByPk(routePrime.id, {
      include: [
        { model: Location, as: 'sourceLocation', attributes: ['id', 'name', 'color'] },
        { model: Location, as: 'destLocation', attributes: ['id', 'name', 'color'] },
      ],
    });
    res.status(201).json(full);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Cette route de livraison existe déjà.' });
    }
    console.error('Create Delivery Prime Error:', error);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// PUT /api/delivery-primes/:id - Update a route prime
router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const routePrime = await DeliveryRoutePrime.findByPk(req.params.id);
    if (!routePrime) return res.status(404).json({ error: 'Route non trouvée.' });

    const { sourceLocationId, destLocationId, destWilaya, prime, notes } = req.body;

    await routePrime.update({
      sourceLocationId: sourceLocationId !== undefined ? (sourceLocationId || null) : routePrime.sourceLocationId,
      destLocationId: destLocationId !== undefined ? (destLocationId || null) : routePrime.destLocationId,
      destWilaya: destWilaya !== undefined ? (destWilaya || null) : routePrime.destWilaya,
      prime: prime !== undefined ? prime : routePrime.prime,
      notes: notes !== undefined ? notes : routePrime.notes,
    });

    const full = await DeliveryRoutePrime.findByPk(routePrime.id, {
      include: [
        { model: Location, as: 'sourceLocation', attributes: ['id', 'name', 'color'] },
        { model: Location, as: 'destLocation', attributes: ['id', 'name', 'color'] },
      ],
    });
    res.json(full);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Cette route de livraison existe déjà.' });
    }
    console.error('Update Delivery Prime Error:', error);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// DELETE /api/delivery-primes/:id - Delete a route prime
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const routePrime = await DeliveryRoutePrime.findByPk(req.params.id);
    if (!routePrime) return res.status(404).json({ error: 'Route non trouvée.' });

    await routePrime.destroy();
    res.json({ message: 'Route supprimée avec succès.' });
  } catch (error) {
    console.error('Delete Delivery Prime Error:', error);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// GET /api/delivery-primes/lookup - Find the prime for a specific route
router.get('/lookup', authenticate, async (req, res) => {
  try {
    const { sourceLocationId, destLocationId, destWilaya } = req.query;

    const where = {
      sourceLocationId: sourceLocationId || null,
    };

    if (destLocationId) {
      where.destLocationId = destLocationId;
      where.destWilaya = null;
    } else if (destWilaya) {
      where.destWilaya = destWilaya;
      where.destLocationId = null;
    } else {
      return res.status(400).json({ error: 'Destination requise.' });
    }

    const routePrime = await DeliveryRoutePrime.findOne({ where });
    res.json(routePrime || { prime: 0, message: 'Aucune prime configurée pour cette route.' });
  } catch (error) {
    console.error('Lookup Prime Error:', error);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
