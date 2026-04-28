const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DeliveryRoutePrime = sequelize.define('DeliveryRoutePrime', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  sourceLocationId: {
    type: DataTypes.INTEGER,
    allowNull: true, // null = Usine
    references: {
      model: 'locations',
      key: 'id',
    },
  },
  destLocationId: {
    type: DataTypes.INTEGER,
    allowNull: true, // For internal transfers (Location → Location)
    references: {
      model: 'locations',
      key: 'id',
    },
  },
  destWilaya: {
    type: DataTypes.STRING(100),
    allowNull: true, // For client deliveries (Location → Wilaya)
  },
  prime: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'delivery_route_primes',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['sourceLocationId', 'destLocationId', 'destWilaya'],
      name: 'unique_route_prime',
    },
  ],
});

module.exports = DeliveryRoutePrime;
