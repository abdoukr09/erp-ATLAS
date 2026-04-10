const express = require('express');
const { Expense, Employee, EmployeePayment, Order, Payment, Production, ModelMaterial, Material } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

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

    // 4. Employee Costs (Actual Payments Made ONLY)
    // We only count money that has ACTUALLY left the treasury (validated payments/bonuses).
    // Declared base salaries or insurance profiles do not immediately subtract from profits until paid.
    const totalDynamicPayments = await EmployeePayment.sum('amount') || 0;
    const totalLaborCost = totalDynamicPayments;

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
