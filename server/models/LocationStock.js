const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LocationStock = sequelize.define('LocationStock', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  locationId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'locations',
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
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
}, {
  tableName: 'location_stocks',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['locationId', 'productModelId'],
    },
  ],
});

module.exports = LocationStock;
