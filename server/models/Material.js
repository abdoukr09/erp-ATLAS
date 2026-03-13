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
  category: {
    type: DataTypes.ENUM('wood', 'foam', 'fabric', 'legs', 'screws', 'leather', 'sponge', 'other'),
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
