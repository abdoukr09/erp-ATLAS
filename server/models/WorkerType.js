const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WorkerType = sequelize.define('WorkerType', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
  },
}, {
  tableName: 'worker_types',
  timestamps: true,
});

module.exports = WorkerType;
