const sequelize = require('./config/database');
const { Order, Payment } = require('./models');

async function run() {
  await sequelize.sync();
  
  // Find orders with totalPrice ~ 1,120,000
  const orders = await Order.findAll({
    where: { totalPrice: 1120000 }
  });
  
  for (const o of orders) {
    console.log(`\n\n--- Order #${o.id} ---`);
    console.log(`Total: ${o.totalPrice}, Advance: ${o.advancePayment}, Remaining: ${o.remainingPayment}, Status: ${o.status}, PaymentStatus: ${o.paymentStatus}`);
    
    const payments = await Payment.findAll({ where: { orderId: o.id } });
    console.log("Payments for this order:");
    for (const p of payments) {
      console.log(` - Payment #${p.id}: Amount ${p.amount}, Type ${p.type}, Status ${p.status}`);
    }
  }
}
run();
