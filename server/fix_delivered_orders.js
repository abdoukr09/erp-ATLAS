const { Order, Payment } = require('./models');
const sequelize = require('./config/database');

async function fixOrders() {
  console.log("Starting order fix...");
  const t = await sequelize.transaction();
  try {
    const deliveredOrders = await Order.findAll({
      where: { status: 'delivered' },
      transaction: t
    });
    
    let fixedCount = 0;
    
    for (const order of deliveredOrders) {
      const totalPaid = await Payment.sum('amount', {
        where: { orderId: order.id, status: 'completed' },
        transaction: t
      }) || 0;
      
      const remainingAmount = Math.max(0, Number(order.totalPrice) - Number(totalPaid));
      
      if (remainingAmount > 0) {
        await Payment.create({
          orderId: order.id,
          amount: remainingAmount,
          method: 'cash',
          status: 'completed',
          type: 'final',
          paymentDate: order.orderDate || new Date(),
          notes: 'Migration: Paiement final automatique à la livraison manquant',
        }, { transaction: t });
        
        await order.update({
          remainingPayment: 0,
          paymentStatus: 'fully_paid'
        }, { transaction: t });
        
        fixedCount++;
        console.log(`Fixed Order #${order.id} - Paid remaining ${remainingAmount} DA`);
      } else if (Number(order.remainingPayment) !== 0 || order.paymentStatus !== 'fully_paid') {
         await order.update({
          remainingPayment: 0,
          paymentStatus: 'fully_paid'
        }, { transaction: t });
        fixedCount++;
        console.log(`Fixed Order #${order.id} - Zeroed out remaining balance`);
      }
    }
    
    await t.commit();
    console.log(`Successfully fixed ${fixedCount} orders.`);
  } catch (err) {
    await t.rollback();
    console.error("Error fixing orders:", err);
  } finally {
    process.exit(0);
  }
}

fixOrders();
