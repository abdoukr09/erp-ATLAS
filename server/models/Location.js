const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Location = sequelize.define('Location', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
 name: {
  type: DataTypes.STRING(100),
  allowNull: false,
  unique: true,
  validate: {
    notEmpty: true,
    len: [2, 100],
  },
},
  color: {
    type: DataTypes.STRING(20),
    allowNull: true,
    defaultValue: '#3b82f6', // Default blue
  },
}, {
  tableName: 'locations',
  timestamps: true,
});

module.exports = Location;
