/**
 * RefreshToken Model
 * Stores server-side refresh tokens for revocability.
 * Each token is tied to a specific user and has an expiry date.
 * On logout or forced revocation, the token is deleted — instantly invalidating the session.
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RefreshToken = sequelize.define('RefreshToken', {
  id:        { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  token:     { type: DataTypes.STRING(512), allowNull: false, unique: true },
  userId:    { type: DataTypes.INTEGER, allowNull: false },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
}, {
  tableName: 'refresh_tokens',
  timestamps: true,
});

module.exports = RefreshToken;
