const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OrderItem = sequelize.define('OrderItem', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  orderId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'orders',
      key: 'id',
    },
  },
  sofaModel: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
  unitPrice: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
  },
  fabric: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  color: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  discountPercentage: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0,
  },
  status: {
    type: DataTypes.ENUM('pending', 'in_production', 'ready', 'delivered', 'cancelled'),
    defaultValue: 'pending',
  },
}, {
  tableName: 'order_items',
  timestamps: true,
});

module.exports = OrderItem;
