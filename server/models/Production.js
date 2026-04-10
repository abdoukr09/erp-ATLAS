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
  orderItemId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'order_items',
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
    type: DataTypes.TEXT,
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
  completedById: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'employees',
      key: 'id',
    },
  },
  completionDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  taskName: {
    type: DataTypes.STRING(100), // e.g., 'Tapissage', 'Menuiserie', 'Couture'
    allowNull: true,
  },
  commissionType: {
    type: DataTypes.ENUM('fixed', 'percentage'),
    allowNull: true,
  },
  commissionValue: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0,
  },
  basePrice: {
    // The price this commission was based on at the time of creation (e.g. Order Final Price)
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true, 
  },
  materialsDeducted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
    quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  startTime: {
    type: DataTypes.STRING(10), // HH:mm
    allowNull: true,
  },
  endTime: {
    type: DataTypes.STRING(10), // HH:mm
    allowNull: true,
  },
}, {
  tableName: 'productions',
  timestamps: true,
  indexes: [
    {
      // BULLETPROOF: Database-level unique constraint prevents duplicate productions for the same order item
      // Even if 50 requests arrive simultaneously, PostgreSQL will reject all but the first
      unique: true,
      fields: ['orderItemId'],
      where: { orderItemId: { [require('sequelize').Op.ne]: null } }, // Only enforce when orderItemId is set (stock productions have null)
      name: 'unique_order_item_production'
    }
  ]
});

module.exports = Production;
