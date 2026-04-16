const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Delivery = sequelize.define('Delivery', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  orderId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'orders',
      key: 'id',
    },
  },
  type: {
    type: DataTypes.ENUM('order', 'transfer'),
    allowNull: false,
    defaultValue: 'order',
  },
  sourceLocationId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'locations',
      key: 'id',
    },
  },
  destLocationId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'locations',
      key: 'id',
    },
  },
  driver: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  deliveryDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('scheduled', 'in_transit', 'delivered', 'failed', 'cancelled'),
    allowNull: false,
    defaultValue: 'scheduled',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'deliveries',
  timestamps: true,
});

module.exports = Delivery;
