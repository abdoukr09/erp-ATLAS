const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PackItem = sequelize.define('PackItem', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  packId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'product_models',
      key: 'id',
    },
  },
  productId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'product_models',
      key: 'id',
    },
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
}, {
  tableName: 'pack_items',
  timestamps: false,
});

module.exports = PackItem;
