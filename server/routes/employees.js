const express = require('express');
const { Employee, EmployeePayment, Production, ProductModel } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();
const { Op } = require('sequelize');

// --- EMPLOYEES CRUD ---
router.get('/', authenticate, authorize('admin', 'gerant'), async (req, res) => {
  try {
    const employees = await Employee.findAll({ 
      order: [['name', 'ASC']],
      include: [{ model: EmployeePayment, as: 'payments' }]
    });
    res.json(employees);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', authenticate, authorize('admin', 'gerant'), async (req, res) => {
  try {
    const employee = await Employee.create(req.body);
    res.status(201).json(employee);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', authenticate, authorize('admin', 'gerant'), async (req, res) => {
  try {
    const employee = await Employee.findByPk(req.params.id);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    await employee.update(req.body);
    res.json(employee);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', authenticate, authorize('admin', 'gerant'), async (req, res) => {
  try {
    const employee = await Employee.findByPk(req.params.id);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    await employee.destroy();
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// --- EMPLOYEE PAYMENTS ---
router.post('/:id/payments', authenticate, authorize('admin', 'gerant'), async (req, res) => {
  try {
    req.body.employeeId = req.params.id;
    const payment = await EmployeePayment.create(req.body);
    res.status(201).json(payment);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:empId/payments/:payId', authenticate, authorize('admin', 'gerant'), async (req, res) => {
  try {
    const payment = await EmployeePayment.findByPk(req.params.payId);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    await payment.destroy();
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// --- PERFORMANCE & COMMISSIONS ---
// Get all items completed by this employee in a given month (YYYY-MM)
router.get('/:id/performance', authenticate, authorize('admin', 'gerant'), async (req, res) => {
  try {
    const employeeId = req.params.id;
    const monthStr = req.query.month; // e.g., '2023-10'
    
    if (!monthStr) return res.status(400).json({ error: 'Month parameter required (YYYY-MM)' });

    const startDate = `${monthStr}-01`;
    // Create an end date for the query (first day of next month)
    const year = parseInt(monthStr.split('-')[0]);
    const month = parseInt(monthStr.split('-')[1]);
    const nextMonthObj = new Date(year, month, 1);
    const endDate = nextMonthObj.toISOString().split('T')[0];

    const completedProductions = await Production.findAll({
      where: {
        completedById: employeeId,
        status: 'completed',
        completionDate: {
          [Op.gte]: startDate,
          [Op.lt]: endDate
        }
      },
      include: [
        { model: ProductModel, as: 'productModel' }
      ]
    });

    res.json(completedProductions);
  } catch (error) {
    console.error('Performance Calc Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
