const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProductionWorker = sequelize.define('ProductionWorker', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  productionId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'productions',
      key: 'id',
    },
  },
  workerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'employees',
      key: 'id',
    },
  },
  commissionType: {
    type: DataTypes.ENUM('fixed', 'percentage'),
    allowNull: true,
    defaultValue: 'percentage',
  },
  commissionValue: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0,
  },
  workerTypeId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'worker_types',
      key: 'id',
    },
  },
  componentModelId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'product_models',
      key: 'id',
    },
  },
  componentIndex: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
  }
}, {
  tableName: 'production_workers',
  timestamps: true,
});

module.exports = ProductionWorker;
