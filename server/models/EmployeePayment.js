const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const EmployeePayment = sequelize.define('EmployeePayment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  employeeId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'employees',
      key: 'id'
    }
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING(255),
    allowNull: true,
  }
}, {
  tableName: 'employee_payments',
  timestamps: true,
});

module.exports = EmployeePayment;
