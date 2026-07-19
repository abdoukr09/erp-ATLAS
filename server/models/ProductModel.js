const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProductModel = sequelize.define('ProductModel', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  // Physical QR identifier printed on labels, e.g. "ATL-M-000042".
  // Filled by the `trg_product_models_barcode` DB trigger on INSERT, so every
  // writer (this API, a script, the Supabase editor) gets one automatically.
  // Uniqueness is enforced by the `product_models_barcode_key` index in Postgres,
  // deliberately NOT declared here: sync({ alter: true }) in dev would recreate a
  // duplicate unique index on every boot.
  barcode: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  category: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: 'Sofa',
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  basePrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0,
  },
  isPack: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  stock: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
}, {
  tableName: 'product_models',
  timestamps: true,
});

module.exports = ProductModel;
