const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Material = sequelize.define('Material', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  // Physical QR identifier printed on labels, e.g. "ATL-P-000117".
  // Filled by the `trg_materials_barcode` DB trigger on INSERT.
  // Uniqueness enforced by the `materials_barcode_key` index in Postgres — see
  // the note in ProductModel.js for why it is not declared here.
  barcode: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  category: {
    type: DataTypes.ENUM('wood', 'foam', 'fabric', 'legs', 'screws', 'leather', 'sponge', 'meuble', 'other'),
    allowNull: false,
    defaultValue: 'other',
  },
  stock: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  },
  unit: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'pcs',
  },
  minStock: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 10,
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0,
  },
  supplier: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
}, {
  tableName: 'materials',
  timestamps: true,
});

module.exports = Material;
