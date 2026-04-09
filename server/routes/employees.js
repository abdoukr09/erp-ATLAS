const express = require('express');
const { Employee, EmployeePayment, Production, Order, ProductModel } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { Op } = require('sequelize');
const router = express.Router();

// GET /api/employees - List all employees with payments (Management only)
router.get('/', authenticate, authorize('admin', 'gerant', 'production'), async (req, res) => {
  try {
    const employees = await Employee.findAll({
      include: [{ model: EmployeePayment, as: 'payments', attributes: ['id', 'amount', 'date', 'description'] }],
      order: [['name', 'ASC']],
    });
    res.json(employees);
  } catch (error) {
    console.error('Get Employees Error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/employees/:id/performance - Performance metrics (Management only)
router.get('/:id/performance', authenticate, authorize('admin', 'gerant', 'production'), async (req, res) => {
  try {
    const { month } = req.query; // Expected: 'YYYY-MM'
    if (!month) return res.status(400).json({ error: 'Month is required.' });

    const year = parseInt(month.split('-')[0]);
    const monthNum = parseInt(month.split('-')[1]);
    const startDate = `${month}-01`;
    const endDate = `${month}-${new Date(year, monthNum, 0).getDate()}`; // Last day of month

    const employeeId = req.params.id;

    const { ProductionWorker, WorkerType } = require('../models');

    const productionWorkers = await ProductionWorker.findAll({
      where: { workerId: employeeId },
      include: [
        { 
          model: Production, 
          as: 'production', 
          where: { 
            status: 'completed',
            completionDate: { [Op.between]: [startDate, endDate] }
          },
          include: [
            { model: Order, as: 'order', attributes: ['totalPrice'] },
            { model: ProductModel, as: 'productModel', attributes: ['name'] }
          ]
        },
        { model: WorkerType, as: 'workerType', attributes: ['id', 'name'] }
      ]
    });

    const productions = productionWorkers.map(pw => {
       const p = pw.production.toJSON();
       p.commissionValue = pw.commissionValue;
       p.commissionType = pw.commissionType;
       p.workerTypeName = pw.workerType?.name || null;
       return p;
    });

    const { OrderSalesman } = require('../models');
    
    const legacySales = await Order.findAll({
      where: {
        salesmanId: employeeId,
        orderDate: { [Op.between]: [startDate, endDate] }
      }
    });

    const junctionSales = await OrderSalesman.findAll({
      where: { salesmanId: employeeId },
      include: [{
        model: Order,
        as: 'order',
        where: { orderDate: { [Op.between]: [startDate, endDate] } }
      }]
    });

    const salesMap = new Map();
    
    legacySales.forEach(order => {
      const o = order.toJSON();
      o.splitPercentage = 100;
      salesMap.set(o.id, o);
    });

    junctionSales.forEach(js => {
      if (js.order) {
        const o = js.order.toJSON();
        o.splitPercentage = Number(js.splitPercentage) || 100;
        salesMap.set(o.id, o);
      }
    });

    const sales = Array.from(salesMap.values());

    res.json({ productions, sales });
  } catch (error) {
    console.error('Get Performance Error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/employees - Create employee
router.post('/', authenticate, authorize('admin', 'gerant', 'production'), async (req, res) => {
  try {
    const { name, category, baseSalary, insuranceCost, commissionRate, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required.' });

    const employee = await Employee.create({
      name, category, baseSalary, insuranceCost, commissionRate, notes
    });
    res.status(201).json(employee);
  } catch (error) {
    console.error('Create Employee Error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /api/employees/:id - Update employee
router.put('/:id', authenticate, authorize('admin', 'gerant', 'production'), async (req, res) => {
  try {
    const employee = await Employee.findByPk(req.params.id);
    if (!employee) return res.status(404).json({ error: 'Employee not found.' });

    await employee.update(req.body);
    res.json(employee);
  } catch (error) {
    console.error('Update Employee Error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/employees/:id - Delete employee
router.delete('/:id', authenticate, authorize('admin', 'gerant', 'production'), async (req, res) => {
  try {
    const employee = await Employee.findByPk(req.params.id);
    if (!employee) return res.status(404).json({ error: 'Employee not found.' });

    await employee.destroy();
    res.json({ message: 'Employee deleted.' });
  } catch (error) {
    console.error('Delete Employee Error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/employees/:id/payments - Add payment for employee
router.post('/:id/payments', authenticate, authorize('admin', 'gerant', 'production'), async (req, res) => {
  try {
    const { amount, date, description } = req.body;
    if (amount === undefined || amount === null || !date) return res.status(400).json({ error: 'Amount and date are required.' });

    const payment = await EmployeePayment.create({
      employeeId: req.params.id,
      amount,
      date,
      description
    });
    res.status(201).json(payment);
  } catch (error) {
    console.error('Create Employee Payment Error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/employees/:id/payments/:payId - Delete employee payment
router.delete('/:id/payments/:payId', authenticate, authorize('admin', 'gerant', 'production'), async (req, res) => {
  try {
    const payment = await EmployeePayment.findByPk(req.params.payId);
    if (!payment) return res.status(404).json({ error: 'Payment not found.' });

    await payment.destroy();
    res.json({ message: 'Payment deleted.' });
  } catch (error) {
    console.error('Delete Employee Payment Error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
