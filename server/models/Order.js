const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  customerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'customers',
      key: 'id',
    },
  },
  sofaModel: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  fabric: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  color: {
    type: DataTypes.STRING(30),
    allowNull: true,
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
  unitPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  },
  discountPercentage: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 0,
  },
  totalPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  },
  advancePayment: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  },
  remainingPayment: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  },
  paymentStatus: {
    type: DataTypes.ENUM('unpaid', 'advance_paid', 'fully_paid'),
    allowNull: false,
    defaultValue: 'unpaid',
  },
  status: {
    type: DataTypes.ENUM('pending', 'in_production', 'ready', 'delivered', 'cancelled'),
    allowNull: false,
    defaultValue: 'pending',
  },
  deliveryAddress: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  orderDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  salesmanId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'employees',
      key: 'id',
    },
  },
  commissionType: {
    type: DataTypes.ENUM('fixed', 'percentage'),
    allowNull: true,
    defaultValue: 'percentage', // Default to percentage for salesmen
  },
  commissionValue: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0,
  }
}, {
  tableName: 'orders',
  timestamps: true,
});

module.exports = Order;
