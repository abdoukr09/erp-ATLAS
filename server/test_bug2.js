const sequelize = require('./config/database');
const { Order, Payment } = require('./models');

async function run() {
  await sequelize.sync();
  
  // Find ALL final payments with amount 0
  const payments = await Payment.findAll({
    where: { type: 'final', amount: 0 }
  });
  
  console.log(`Found ${payments.length} final payments with amount 0.`);
  
  for (const p of payments) {
    const o = await Order.findByPk(p.orderId);
    console.log(`\n--- Payment #${p.id} ---`);
    console.log(`Order Total: ${o?.totalPrice}, Advance: ${o?.advancePayment}, Remaining: ${o?.remainingPayment}`);
  }
}
run();
