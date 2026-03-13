const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ModelMaterial = sequelize.define('ModelMaterial', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  modelId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'product_models',
      key: 'id',
    },
  },
  materialId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'materials',
      key: 'id',
    },
  },
  quantity: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 1,
  },
}, {
  tableName: 'model_materials',
  timestamps: false,
});

module.exports = ModelMaterial;
