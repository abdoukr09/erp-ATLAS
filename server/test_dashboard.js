const { Order, Customer, Material, Production, Payment, Delivery } = require('./models');
const sequelize = require('./config/database');
const { Op } = require('sequelize');

async function test() {
  try {
    console.log("Testing dashboard queries...");
    
    console.log("1. totalOrders");
    const totalOrders = await Order.count();

    console.log("2. totalRevenue");
    const totalRevenue = await Payment.sum('amount', { where: { status: 'completed' } }) || 0;

    console.log("3. activeProductions count");
    const activeProductions = await Production.count({
      where: { status: { [Op.in]: ['pending', 'in_progress'] } },
    });

    console.log("4. activeProductionDetails");
    const activeProductionDetails = await Production.findAll({
      where: { 
        status: { [Op.in]: ['pending', 'in_progress'] },
        orderId: { [Op.not]: null } 
      },
      include: [
        { 
          model: Order, 
          as: 'order', 
          attributes: ['id', 'sofaModel'],
          include: [{ model: Customer, as: 'customer', attributes: ['name'] }]
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: 15,
    });

    console.log("5. pendingDeliveries");
    const pendingDeliveries = await Delivery.count({
      where: { status: { [Op.in]: ['scheduled', 'in_transit'] } },
    });

    console.log("6. recentOrders");
    const recentOrders = await Order.findAll({
      attributes: ['id', 'sofaModel', 'totalPrice', 'advancePayment', 'remainingPayment', 'paymentStatus', 'status', 'orderDate'],
      include: [{ model: Customer, as: 'customer', attributes: ['name'] }],
      order: [['createdAt', 'DESC']],
      limit: 10,
    });

    console.log("7. monthlyRevenueByType");
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const monthlyRevenueByType = await Payment.findAll({
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

    console.log("8. orderStatusDistribution");
    const orderStatusDistribution = await Order.findAll({
      attributes: [ 'status', [sequelize.fn('count', sequelize.col('id')), 'count'] ],
      group: ['status'],
      raw: true,
    });

    console.log("✅ All queries executed without crash.");
  } catch (e) {
    console.error("❌ Stats query failed:", e.message);
  } finally {
    process.exit();
  }
}
test();
