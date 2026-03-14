const express = require('express');
const { Expense, Employee, EmployeePayment, Order, Payment, Production, ModelMaterial, Material } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

// --- EMPLOYEES ---
router.get('/employees', authenticate, authorize('admin', 'gerant'), async (req, res) => {
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

router.post('/employees', authenticate, authorize('admin', 'gerant'), async (req, res) => {
  try {
    const employee = await Employee.create(req.body);
    res.status(201).json(employee);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/employees/:id', authenticate, authorize('admin', 'gerant'), async (req, res) => {
  try {
    const employee = await Employee.findByPk(req.params.id);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    await employee.update(req.body);
    res.json(employee);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/employees/:id', authenticate, authorize('admin', 'gerant'), async (req, res) => {
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
router.post('/employees/:id/payments', authenticate, authorize('admin', 'gerant'), async (req, res) => {
  try {
    req.body.employeeId = req.params.id;
    const payment = await EmployeePayment.create(req.body);
    res.status(201).json(payment);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/employees/:empId/payments/:payId', authenticate, authorize('admin', 'gerant'), async (req, res) => {
  try {
    const payment = await EmployeePayment.findByPk(req.params.payId);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    await payment.destroy();
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// --- EXPENSES ---
router.get('/expenses', authenticate, authorize('admin', 'gerant'), async (req, res) => {
  try {
    const expenses = await Expense.findAll({ order: [['date', 'DESC']] });
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/expenses', authenticate, authorize('admin', 'gerant'), async (req, res) => {
  try {
    const expense = await Expense.create(req.body);
    res.status(201).json(expense);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/expenses/:id', authenticate, authorize('admin', 'gerant'), async (req, res) => {
  try {
    const expense = await Expense.findByPk(req.params.id);
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    await expense.destroy();
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});


// --- REAL PROFIT CALCULATION ---
// Calculates total revenue, deducts raw material costs based on delivered orders, deducts expenses, and dynamic salaries.
router.get('/profit-summary', authenticate, authorize('admin', 'gerant'), async (req, res) => {
  try {
    // 1. Total Finalized Revenue (Incoming money from completed payments)
    const totalPayments = await Payment.sum('amount', { where: { status: 'completed' } }) || 0;

    // 2. Material Costs for Delivered Orders (Prix de revient matière)
    let totalMaterialCost = 0;
    const allOrders = await Order.findAll({ where: { status: 'delivered' } });
    for (const order of allOrders) {
        const modelDef = await require('../models').ProductModel.findOne({ 
            where: { name: order.sofaModel },
            include: [{ model: Material, as: 'materials', through: { attributes: ['quantity'] } }]
        });

        if (modelDef && modelDef.materials) {
            let modelCost = 0;
            for (const mat of modelDef.materials) {
                const reqQty = Number(mat.ModelMaterial.quantity) || 0;
                const matPrice = Number(mat.price) || 0;
                modelCost += (reqQty * matPrice);
            }
            totalMaterialCost += (modelCost * Number(order.quantity));
        }
    }

    // 3. Operating Expenses
    const totalExpenses = await Expense.sum('amount') || 0;

    // 4. Employee Costs (Actual Payments Made + Fixed Insurance)
    const employees = await Employee.findAll();
    let totalFixedInsuranceCost = 0;
    employees.forEach(e => {
        totalFixedInsuranceCost += Number(e.insuranceCost) || 0;
    });

    const totalDynamicPayments = await EmployeePayment.sum('amount') || 0;
    const totalLaborCost = totalFixedInsuranceCost + totalDynamicPayments;

    const netProfit = totalPayments - totalMaterialCost - totalExpenses - totalLaborCost;

    res.json({
      revenue: Number(totalPayments),
      costs: {
        materials: Number(totalMaterialCost),
        expenses: Number(totalExpenses),
        labor: Number(totalLaborCost) 
      },
      netProfit: Number(netProfit)
    });

  } catch (error) {
    console.error('Profit Calc Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
