const express = require('express');
const { Expense, Employee, Order, Payment, Production, ModelMaterial, Material } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

// --- EMPLOYEES ---
router.get('/employees', authenticate, authorize('admin', 'gerant'), async (req, res) => {
  try {
    const employees = await Employee.findAll({ order: [['name', 'ASC']] });
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
// Calculates total revenue, deducts raw material costs based on delivered orders, deducts expenses, and salaries.
router.get('/profit-summary', authenticate, authorize('admin', 'gerant'), async (req, res) => {
  try {
    // 1. Total Finalized Revenue (Incoming money from completed payments)
    const totalPayments = await Payment.sum('amount', { where: { status: 'completed' } }) || 0;

    // 2. Material Costs for Delivered Orders (Prix de revient matière)
    const deliveredOrders = await Order.findAll({
      where: { status: 'delivered' },
      include: [
        {
          model: Production, as: 'productions',
          include: [
            {
              model: ModelMaterial, as: 'modelMaterial', // Need custom include logic for BOM
            }
          ]
        }
      ]
    });
    
    // Simplification for immediate result: Calculate total estimated material cost based on all delivered orders
    // For a highly accurate calculation, we iterate through all delivered orders, get their model, get its BOM, and multiply by material price.
    let totalMaterialCost = 0;
    const allOrders = await Order.findAll({ where: { status: 'delivered' } });
    for (const order of allOrders) {
        // We find the associated product model logic if needed, but since orders are free-text Models right now,
        // we might not have a direct link to the ProductModel ID in the Order table.
        // Wait, Order currently has `sofaModel` (String) not `productModelId`.
        // This is a known limitation of the current schema where Orders don't directly reference ProductModel by ID.
        // To approximate, we try to find a ProductModel with the exact same name.
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

    // 4. Employee Costs (Monthly Salary + Insurance)
    const employees = await Employee.findAll();
    let totalEmployeeMonthlyCost = 0;
    employees.forEach(e => {
        totalEmployeeMonthlyCost += Number(e.monthlySalary) + Number(e.insuranceCost);
    });
    
    // For the sake of the demo, let's assume the profit summary is for the current month.
    // In a production app, you'd pass date filters and multiply salaries by months active.

    const netProfit = totalPayments - totalMaterialCost - totalExpenses - totalEmployeeMonthlyCost;

    res.json({
      revenue: Number(totalPayments),
      costs: {
        materials: Number(totalMaterialCost),
        expenses: Number(totalExpenses),
        labor: Number(totalEmployeeMonthlyCost) // 1 month of labor for current view
      },
      netProfit: Number(netProfit)
    });

  } catch (error) {
    console.error('Profit Calc Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
