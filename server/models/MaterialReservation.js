const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MaterialReservation = sequelize.define('MaterialReservation', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  orderId: { type: DataTypes.INTEGER, allowNull: false },
  materialId: { type: DataTypes.INTEGER, allowNull: false },
  quantity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: { min: 0 }
  },
  status: {
    type: DataTypes.ENUM('reserved', 'deducted', 'released'),
    defaultValue: 'reserved'
  }
}, {
  tableName: 'material_reservations',
  timestamps: true
});

module.exports = MaterialReservation;
