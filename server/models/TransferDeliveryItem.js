const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TransferDeliveryItem = sequelize.define('TransferDeliveryItem', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  deliveryId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'deliveries',
      key: 'id',
    },
  },
  productModelId: {
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
  tableName: 'transfer_delivery_items',
  timestamps: true,
});

module.exports = TransferDeliveryItem;
