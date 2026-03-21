const { Production, OrderItem, Order, Customer } = require('./models');
const { Op } = require('sequelize');

async function run() {
  try {
    const activeProductionDetails = await Production.findAll({
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
    console.log("✅ Dashboard queries loaded safely! Count:", activeProductionDetails.length);
  } catch (err) {
    console.error("❌ Dashboard query failed:", err);
  }
  process.exit();
}

run();
