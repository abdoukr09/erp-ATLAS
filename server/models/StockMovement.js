const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// ─── Stock movements ────────────────────────────────────────────────────────
// The append-only log behind offline scanning. Tablets NEVER push an absolute
// stock value — only signed deltas — so several devices (and the office working
// on the web at the same time) can all write without overwriting each other.
//
// Each row is one scan or manual adjustment. Replaying the same batch is safe:
// `opUuid` is unique, so a movement that already landed is skipped instead of
// being applied twice. See routes/sync.js.
const StockMovement = sequelize.define('StockMovement', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  // Idempotency key, generated on the device at scan time (crypto.randomUUID).
  // Uniqueness is enforced by the `stock_movements_opuuid_key` index created in
  // init_stock_movements.js — deliberately NOT declared here, because
  // sync({ alter: true }) in dev recreates a duplicate unique index on every
  // boot (same reasoning as ProductModel.barcode).
  opUuid: {
    type: DataTypes.STRING(64),
    allowNull: false,
  },
  // Which tablet produced it — lets us trace a wrong count back to a device.
  deviceId: {
    type: DataTypes.STRING(64),
    allowNull: true,
  },
  // Who was logged in when the movement was created, not who synced it: an
  // offline movement is attributed to its author even if it uploads much later.
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  targetType: {
    type: DataTypes.ENUM('model', 'material'),
    allowNull: false,
  },
  targetId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  // The scanned string (ATL-M-xxxxxx → product_models, ATL-P-xxxxxx → materials).
  // Kept even when the target is resolved, so a movement stays readable if the
  // article is later renamed or deleted.
  barcode: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  // Signed: +n for a restock, -n for a withdrawal. Never an absolute quantity.
  delta: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  source: {
    type: DataTypes.ENUM('scan', 'manuel'),
    allowNull: false,
    defaultValue: 'scan',
  },
  note: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
}, {
  tableName: 'stock_movements',
  timestamps: true,
  indexes: [
    { fields: ['deviceId'] },
    { fields: ['targetType', 'targetId'] },
  ],
});

module.exports = StockMovement;
