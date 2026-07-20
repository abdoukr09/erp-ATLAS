const express = require('express');
const { ProductModel, Material, StockMovement } = require('../models');
const sequelize = require('../config/database');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

// ─── Offline sync for the warehouse tablets ─────────────────────────────────
// Tablets send MOVEMENTS (+n / -n), never absolute stock values. That is the
// whole reason several tablets can scan the same article offline while the
// office edits it on the web: deltas add up, absolute values would overwrite.

/** ATL-M-xxxxxx → product_models, ATL-P-xxxxxx → materials.
 *  Counter-intuitive on purpose: M is for "Modèle", P for the packaged parts
 *  stored as materials. Verified against live data — do not swap these. */
const TARGETS = {
  model: { prefix: 'ATL-M-', Model: ProductModel, table: 'product_models', notFound: 'Aucun modèle' },
  material: { prefix: 'ATL-P-', Model: Material, table: 'materials', notFound: 'Aucune matière' },
};

/** Infer the target table from the scanned string alone */
function targetTypeFromBarcode(barcode = '') {
  const code = String(barcode).trim().toUpperCase();
  if (code.startsWith(TARGETS.model.prefix)) return 'model';
  if (code.startsWith(TARGETS.material.prefix)) return 'material';
  return null;
}

// ─── POST /api/sync/movements ───────────────────────────────────────────────
// Body: { movements: [{ opUuid, deviceId, targetType?, targetId?, barcode,
//                       delta, source?, note?, userId?, createdAt? }] }
//
// Whole batch runs in ONE transaction, but each movement gets its own SAVEPOINT
// so a single bad barcode reports an error without discarding the good ones.
router.post('/movements', authenticate, async (req, res, next) => {
  const movements = Array.isArray(req.body?.movements) ? req.body.movements : null;

  if (!movements) {
    return res.status(400).json({ error: 'Corps invalide : "movements" doit être un tableau.' });
  }
  if (movements.length === 0) {
    return res.json({ results: [], applied: 0, duplicates: 0, errors: 0 });
  }
  if (movements.length > 500) {
    return res.status(413).json({ error: 'Lot trop volumineux (500 mouvements maximum).' });
  }

  try {
    const results = await sequelize.transaction(async (tx) => {
      const out = [];

      for (const mv of movements) {
        const opUuid = mv?.opUuid;
        const barcode = typeof mv?.barcode === 'string' ? mv.barcode.trim() : '';
        const delta = Number(mv?.delta);

        if (!opUuid) {
          out.push({ opUuid: null, status: 'error', error: 'opUuid manquant.' });
          continue;
        }
        if (!Number.isInteger(delta) || delta === 0) {
          out.push({ opUuid, status: 'error', error: 'delta doit être un entier non nul.' });
          continue;
        }

        // Idempotency: a batch replayed after a lost connection must not double-apply.
        const seen = await StockMovement.findOne({
          where: { opUuid },
          attributes: ['id'],
          transaction: tx,
        });
        if (seen) {
          out.push({ opUuid, status: 'duplicate' });
          continue;
        }

        const targetType = targetTypeFromBarcode(barcode) || mv?.targetType;
        const target = TARGETS[targetType];
        if (!target) {
          out.push({ opUuid, status: 'error', error: `Code inconnu : "${barcode || '(vide)'}".` });
          continue;
        }

        // Each movement in its own SAVEPOINT — a unique-constraint race or a bad
        // row rolls back only itself, the rest of the batch still commits.
        try {
          const applied = await sequelize.transaction({ transaction: tx }, async (sp) => {
            const article = await target.Model.findOne({
              where: { barcode },
              attributes: ['id', 'name', 'stock'],
              transaction: sp,
            });
            if (!article) {
              const err = new Error(`${target.notFound} avec le code "${barcode}".`);
              err.userFacing = true;
              throw err;
            }

            await StockMovement.create({
              opUuid,
              deviceId: mv.deviceId || null,
              // Attribute to the movement's author (offline), fall back to the
              // account performing the upload.
              userId: Number.isInteger(mv.userId) ? mv.userId : req.user.id,
              targetType,
              targetId: article.id,
              barcode,
              delta,
              source: mv.source === 'manuel' ? 'manuel' : 'scan',
              note: mv.note ? String(mv.note).slice(0, 255) : null,
            }, { transaction: sp });

            // Atomic increment, NOT read-modify-write: two tablets syncing at the
            // same instant must both land. Postgres serialises the row update.
            const [rows] = await sequelize.query(
              `UPDATE "${target.table}"
                  SET stock = stock + :delta, "updatedAt" = NOW()
                WHERE id = :id
            RETURNING stock;`,
              {
                replacements: { delta, id: article.id },
                transaction: sp,
                type: sequelize.QueryTypes.SELECT,
              }
            );

            return {
              targetType,
              targetId: article.id,
              name: article.name,
              newStock: rows?.stock !== undefined ? Number(rows.stock) : undefined,
            };
          });

          out.push({ opUuid, status: 'applied', ...applied });
        } catch (err) {
          // Lost a race on opUuid → the other request already applied it.
          if (err?.name === 'SequelizeUniqueConstraintError') {
            out.push({ opUuid, status: 'duplicate' });
          } else if (err?.userFacing) {
            out.push({ opUuid, status: 'error', error: err.message });
          } else {
            console.error('Sync movement failed:', err);
            out.push({ opUuid, status: 'error', error: 'Erreur serveur sur ce mouvement.' });
          }
        }
      }

      return out;
    });

    res.json({
      results,
      applied: results.filter((r) => r.status === 'applied').length,
      duplicates: results.filter((r) => r.status === 'duplicate').length,
      errors: results.filter((r) => r.status === 'error').length,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/sync/snapshot ─────────────────────────────────────────────────
// Everything a tablet needs to work offline, in one call: what each barcode is
// and what the server currently thinks the stock is.
router.get('/snapshot', authenticate, async (req, res, next) => {
  try {
    const [models, materials] = await Promise.all([
      ProductModel.findAll({
        attributes: ['id', 'name', 'barcode', 'stock', 'category'],
        order: [['name', 'ASC']],
      }),
      Material.findAll({
        attributes: ['id', 'name', 'barcode', 'stock', 'category', 'unit'],
        order: [['name', 'ASC']],
      }),
    ]);

    res.json({
      syncedAt: new Date().toISOString(),
      models: models.map((m) => ({
        id: m.id,
        name: m.name,
        barcode: m.barcode,
        stock: Number(m.stock) || 0,
        category: m.category,
        unit: 'pcs',
      })),
      materials: materials.map((m) => ({
        id: m.id,
        name: m.name,
        barcode: m.barcode,
        stock: Number(m.stock) || 0,
        category: m.category,
        unit: m.unit,
      })),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
