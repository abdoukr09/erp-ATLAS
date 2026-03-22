/**
 * LEVEL 10: Enterprise Audit Trail
 * Stores the before/after state of any critical business entity modification.
 * Records the user who made the change, the action (UPDATE/DELETE), and the diff.
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  action: {
    type: DataTypes.ENUM('CREATE', 'UPDATE', 'DELETE'),
    allowNull: false,
  },
  modelName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  recordId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true, // System actions might not have a user
  },
  oldValues: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  newValues: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
}, {
  tableName: 'audit_logs',
  timestamps: true,
  updatedAt: false, // Audit logs are immutable, append-only
});

module.exports = AuditLog;
