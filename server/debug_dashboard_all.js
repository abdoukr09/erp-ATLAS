const { Order, Customer, Material, Production, Payment, Delivery, OrderItem } = require('./models');
const { Op } = require('sequelize');
const sequelize = require('./config/database');

async function run() {
  try {
    console.log("1. Counting Orders...");
    await Order.count();
    
    console.log("2. Counting Customers...");
    await Customer.count();
    
    console.log("3. Summing revenue...");
    await Payment.sum('amount', { where: { status: 'completed' } });

    console.log("4. Finding Active Productions...");
    await Production.findAll({
      where: { 
        status: { [Op.in]: ['pending', 'in_progress'] },
        orderId: { [Op.not]: null }
      },
      include: [
        { 
          model: OrderItem, 
          as: 'orderItem', 
          attributes: ['id', 'sofaModel'],
          include: [{ model: Order, as: 'order', attributes: ['id', 'status'], include: [{ model: Customer, as: 'customer', attributes: ['name'] }] }]
        }
      ],
      limit: 15,
    });

    console.log("5. Finding Recent Orders...");
    await Order.findAll({
      attributes: ['id', 'totalPrice', 'advancePayment', 'remainingPayment', 'paymentStatus', 'status', 'orderDate'],
      include: [
        { model: Customer, as: 'customer', attributes: ['name'] },
        { model: OrderItem, as: 'items', attributes: ['sofaModel', 'quantity'] }
      ],
      limit: 10,
    });

    console.log("6. Testing Monthly Revenue (to_char)...");
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    await Payment.findAll({
      attributes: [
        [sequelize.fn('to_char', sequelize.col('paymentDate'), 'YYYY-MM'), 'month'],
        [sequelize.fn('sum', sequelize.col('amount')), 'total'],
      ],
      where: { status: 'completed', paymentDate: { [Op.gte]: sixMonthsAgo } },
      group: [sequelize.fn('to_char', sequelize.col('paymentDate'), 'YYYY-MM')],
      raw: true,
    });

    console.log("7. Testing Order Status Distribution...");
    await Order.findAll({
      attributes: [
        'status',
        [sequelize.fn('count', sequelize.col('id')), 'count'],
      ],
      group: ['status'],
      raw: true,
    });

    console.log("✅ ALL DASHBOARD QUERIES PASSED SAFE!");
  } catch (err) {
    console.error("❌ CRASH DETECTED:", err);
  }
  process.exit();
}

run();
