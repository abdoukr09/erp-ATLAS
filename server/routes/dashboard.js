const express = require('express');
const { Order, Customer, Material, Production, Payment, Delivery, OrderItem } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const sequelize = require('../config/database');
const { Op } = require('sequelize');
const router = express.Router();

// GET /api/dashboard/stats - Management and Sales (Sales sees scrubbed data)
router.get('/stats', authenticate, authorize('admin', 'gerant', 'sales'), async (req, res) => {
  try {
    const totalOrders = await Order.count();
    const pendingOrders = await Order.count({ where: { status: 'pending' } });
    const inProductionOrders = await Order.count({ where: { status: 'in_production' } });
    const readyOrders = await Order.count({ where: { status: 'ready' } });
    const deliveredOrders = await Order.count({ where: { status: 'delivered' } });

    const totalCustomers = await Customer.count();
    
    const totalRevenue = await Payment.sum('amount', { where: { status: 'completed' } }) || 0;
    const totalAdvancePayments = await Payment.sum('amount', { where: { status: 'completed', type: 'advance' } }) || 0;
    const totalFinalPayments = await Payment.sum('amount', { where: { status: 'completed', type: 'final' } }) || 0;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayRevenue = await Payment.sum('amount', { 
      where: { 
        status: 'completed',
        paymentDate: { [Op.gte]: startOfToday }
      } 
    }) || 0;
    // Low stock: fetch all then filter in-memory (avoids column quoting issues)
    const allMaterials = await Material.findAll();
    const lowStockMaterials = allMaterials.filter(m => Number(m.stock) <= Number(m.minStock));

    const activeProductions = await Production.count({
      where: { status: { [Op.in]: ['pending', 'in_progress'] } },
    });

    const activeProductionDetails = await Production.findAll({
      where: { 
        status: { [Op.in]: ['pending', 'in_progress'] },
        orderId: { [Op.not]: null } // Only show productions linked to customer orders, not catalog stock
      },
      include: [
        { 
          model: OrderItem, 
          as: 'orderItem', 
          attributes: ['id', 'sofaModel'],
          include: [{ model: Order, as: 'order', attributes: ['id', 'status'], include: [{ model: Customer, as: 'customer', attributes: ['name'] }] }]
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: 15,
    });

    const pendingDeliveries = await Delivery.count({
      where: { status: { [Op.in]: ['scheduled', 'in_transit'] } },
    });

    // Recent orders
    const recentOrders = await Order.findAll({
      attributes: ['id', 'totalPrice', 'advancePayment', 'remainingPayment', 'paymentStatus', 'status', 'orderDate', 'createdAt'],
      include: [
        { model: Customer, as: 'customer', attributes: ['name'] },
        { model: OrderItem, as: 'items', attributes: ['sofaModel', 'quantity'] }
      ],
      order: [['createdAt', 'DESC']],
      limit: 10,
    });

    // Monthly revenue (last 6 months)
    let monthlyRevenue = [];
    try {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      monthlyRevenue = await Payment.findAll({
        attributes: [
          [sequelize.fn('to_char', sequelize.col('"paymentDate"'), 'YYYY-MM'), 'month'],
          [sequelize.fn('sum', sequelize.col('amount')), 'total'],
        ],
        where: {
          status: 'completed',
          paymentDate: { [Op.gte]: sixMonthsAgo },
        },
        group: [sequelize.fn('to_char', sequelize.col('"paymentDate"'), 'YYYY-MM')],
        order: [[sequelize.literal('"month"'), 'ASC']],
        raw: true,
      });
    } catch (e) {
      console.error('Monthly revenue query failed:', e.message);
    }

    // Monthly revenue by type (last 6 months)
    let monthlyRevenueByType = [];
    try {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      monthlyRevenueByType = await Payment.findAll({
        attributes: [
          [sequelize.fn('to_char', sequelize.col('"paymentDate"'), 'YYYY-MM'), 'month'],
          'type',
          [sequelize.fn('sum', sequelize.col('amount')), 'total'],
        ],
        where: {
          status: 'completed',
          paymentDate: { [Op.gte]: sixMonthsAgo },
        },
        group: [sequelize.fn('to_char', sequelize.col('"paymentDate"'), 'YYYY-MM'), 'type'],
        order: [[sequelize.literal('"month"'), 'ASC']],
        raw: true,
      });
    } catch (e) {
      console.error('Monthly revenue by type query failed:', e.message);
    }

    // Order status distribution
    const orderStatusDistribution = await Order.findAll({
      attributes: [
        'status',
        [sequelize.fn('count', sequelize.col('id')), 'count'],
      ],
      group: ['status'],
      raw: true,
    });

    const isSales = req.user.role === 'sales';

    res.json({
      stats: {
        totalOrders,
        pendingOrders,
        inProductionOrders,
        readyOrders,
        deliveredOrders,
        totalCustomers,
        totalRevenue: isSales ? 0 : Number(totalRevenue),
        totalAdvancePayments: isSales ? 0 : Number(totalAdvancePayments),
        totalFinalPayments: isSales ? 0 : Number(totalFinalPayments),
        todayRevenue: isSales ? 0 : Number(todayRevenue),
        lowStockCount: lowStockMaterials.length,
        activeProductions,
        pendingDeliveries,
      },
      lowStockMaterials: isSales ? [] : lowStockMaterials,
      activeProductionDetails,
      recentOrders, // Sales can see recent individual orders (as they create them)
      monthlyRevenue: isSales ? [] : monthlyRevenue,
      monthlyRevenueByType: isSales ? [] : monthlyRevenueByType,
      orderStatusDistribution,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
