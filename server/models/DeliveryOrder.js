const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DeliveryOrder = sequelize.define('DeliveryOrder', {
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
  orderId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'orders',
      key: 'id',
    },
  },
}, {
  tableName: 'delivery_orders',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['deliveryId', 'orderId'],
      name: 'unique_delivery_order',
    },
  ],
});

module.exports = DeliveryOrder;
