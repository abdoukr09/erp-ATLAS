const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Payment = sequelize.define('Payment', {
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
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  method: {
    type: DataTypes.ENUM('cash', 'bank_transfer', 'check', 'card'),
    allowNull: false,
    defaultValue: 'cash',
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'refunded'),
    allowNull: false,
    defaultValue: 'pending',
  },
  paymentDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    defaultValue: DataTypes.NOW,
  },
  type: {
    type: DataTypes.ENUM('advance', 'final', 'other'),
    allowNull: false,
    defaultValue: 'other',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'payments',
  timestamps: true,
});

module.exports = Payment;
