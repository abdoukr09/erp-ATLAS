const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OrderSalesman = sequelize.define('OrderSalesman', {
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
  salesmanId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'employees',
      key: 'id',
    },
  },
  splitPercentage: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 100.00,
  },
}, {
  tableName: 'order_salesmen',
  timestamps: true,
});

module.exports = OrderSalesman;
