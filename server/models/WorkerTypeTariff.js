const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WorkerTypeTariff = sequelize.define('WorkerTypeTariff', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  workerTypeId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'worker_types',
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
  paymentType: {
    type: DataTypes.ENUM('fixed', 'percentage'),
    allowNull: false,
    defaultValue: 'fixed',
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  },
}, {
  tableName: 'worker_type_tariffs',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['workerTypeId', 'productModelId'],
    },
  ],
});

module.exports = WorkerTypeTariff;
