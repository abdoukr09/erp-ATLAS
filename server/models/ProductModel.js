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
    unique: true,
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
