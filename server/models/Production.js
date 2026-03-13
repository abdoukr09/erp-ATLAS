const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Production = sequelize.define('Production', {
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
  productModelId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'product_models',
      key: 'id',
    },
  },
  stage: {
    type: DataTypes.ENUM('fabrication', 'cutting', 'foam', 'upholstery', 'assembly', 'finishing', 'quality_check'),
    allowNull: false,
    defaultValue: 'fabrication',
  },
  worker: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('pending', 'in_progress', 'completed'),
    allowNull: false,
    defaultValue: 'pending',
  },
  startDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  endDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  materialsDeducted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  tableName: 'productions',
  timestamps: true,
});

module.exports = Production;
