const { Order, Payment } = require('./models');

async function fix() {
  const orders = await Order.findAll();
  
  for (const o of orders) {
    if (Number(o.advancePayment) > 0) {
      const pays = await Payment.findAll({ where: { orderId: o.id, type: 'advance' } });
      if (pays.length === 0) {
        console.log(`Fixing Order #${o.id}: creating ghost advance payment of ${o.advancePayment}.`);
        
        await Payment.create({
          orderId: o.id,
          amount: o.advancePayment,
          method: 'cash', // Default
          paymentDate: new Date(),
          type: 'advance',
          status: 'completed'
        });

        // Recalculate correctly now
        const totalPaid = await Payment.sum('amount', { where: { orderId: o.id, status: 'completed' } }) || 0;
        const remaining = Number(o.totalPrice) - totalPaid;
        await o.update({
           remainingPayment: remaining,
           paymentStatus: remaining <= 0 ? 'fully_paid' : 'advance_paid'
        });
      }
    }
  }
  console.log('Fixed all missing advances!');
  process.exit(0);
}
fix();
