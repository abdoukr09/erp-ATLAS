const { Order, Payment } = require('./models');

async function check() {
  const orders = await Order.findAll({
    where: {
      // Find orders with an advance payment
    }
  });
  
  let fixes = 0;
  for (const o of orders) {
    if (Number(o.advancePayment) > 0) {
      const pays = await Payment.findAll({ where: { orderId: o.id, type: 'advance' } });
      if (pays.length === 0) {
        console.log(`Order #${o.id} has advancePayment=${o.advancePayment} but NO advance Payment record!`);
        fixes++;
      }
    }
  }
  console.log(`Total missing advance payments: ${fixes}`);
  process.exit(0);
}
check();
