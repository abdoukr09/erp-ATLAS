const { Order, Payment } = require('./models');
const sequelize = require('./config/database');

async function fixPaymentBalances() {
    console.log("Aligning all order payment balances mathematically with split delivery logic...");
    const t = await sequelize.transaction();
    try {
        const orders = await Order.findAll({ transaction: t });
        let fixedCount = 0;
        for (const order of orders) {
            const totalPaid = await Payment.sum('amount', {
                where: { orderId: order.id, status: 'completed' },
                transaction: t
            }) || 0;
            
            const finalPaid = await Payment.sum('amount', {
                where: { orderId: order.id, status: 'completed', type: 'final' },
                transaction: t
            }) || 0;
            
            const advancePaid = Math.max(0, Number(totalPaid) - Number(finalPaid));
            
            const expectedRemaining = Math.max(0, Number(order.totalPrice) - Number(totalPaid));
            const expectedStatus = expectedRemaining <= 0 ? 'fully_paid' : (Number(totalPaid) > 0 ? 'advance_paid' : 'unpaid');
            
            if (Number(order.advancePayment) !== advancePaid || Number(order.remainingPayment) !== expectedRemaining || order.paymentStatus !== expectedStatus) {
                console.log(`Order #${order.id} | DB Adv: ${order.advancePayment} -> Fix: ${advancePaid} | Rem: ${expectedRemaining}`);
                await order.update({
                    advancePayment: advancePaid,
                    remainingPayment: expectedRemaining,
                    paymentStatus: expectedStatus
                }, { transaction: t });
                fixedCount++;
            }
        }
        await t.commit();
        console.log(`Successfully realigned ${fixedCount} orders.`);
    } catch (e) {
        await t.rollback();
        console.error(e);
    } finally {
        process.exit(0);
    }
}
fixPaymentBalances();
