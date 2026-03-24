const { Order, OrderItem, Production } = require('./models');
const sequelize = require('./config/database');

async function testReady() {
  const t = await sequelize.transaction();
  try {
    // 1. Get an existing pending or in_production order
    const order = await Order.findOne({
      where: { status: ['pending', 'in_production'] },
      include: [{ model: OrderItem, as: 'items' }]
    });

    if (!order) {
       console.log("No pending orders found.");
       await t.rollback();
       return;
    }

    console.log(`Found Order #${order.id} with status = ${order.status}`);
    console.log(`Order Items: ${order.items.map(i => `#${i.id}: ${i.status}`).join(', ')}`);

    // Let's check productions for these items
    const productions = await Production.findAll({
      where: { orderItemId: order.items.map(i => i.id) }
    });
    
    console.log(`Found ${productions.length} productions for these items:`, productions.map(p => `prodId=${p.id} status=${p.status}`));

    // Find one that is pending or in_progress to complete it
    const activeProd = productions.find(p => p.status !== 'completed');
    if (!activeProd) {
       console.log("No active production found to complete.");
       await t.rollback();
       return;
    }
    
    console.log(`Going to complete production #${activeProd.id}...`);

    // SIMULATE exactly what the API does
    const reqBodyStatus = 'completed';

    const production = await Production.findByPk(activeProd.id, {
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    
    if (production.orderItemId) {
      production.orderItem = await OrderItem.findByPk(production.orderItemId, { transaction: t });
    }

    if (reqBodyStatus === 'completed' && production.status !== 'completed') {
      if (production.orderItemId) {
         const { Op } = require('sequelize');
         const otherTasksCount = await Production.count({
           where: {
             orderItemId: production.orderItemId,
             id: { [Op.ne]: production.id },
             status: { [Op.ne]: 'completed' }
           },
           transaction: t
         });
         
         console.log(`otherTasksCount = ${otherTasksCount}`);

         if (otherTasksCount === 0) {
            const lockedItem = await OrderItem.findByPk(production.orderItemId, { transaction: t, lock: t.LOCK.UPDATE });
            if (lockedItem) {
                await lockedItem.update({ status: 'ready' }, { transaction: t });
                console.log(`Updated lockedItem #${lockedItem.id} to ready.`);
            }
            
            const itemOrderId = production.orderItem ? production.orderItem.orderId : null;
            console.log(`itemOrderId = ${itemOrderId}`);
            
            const parentOrder = await Order.findByPk(itemOrderId, {
              transaction: t,
              lock: t.LOCK.UPDATE
            });
            
            if (parentOrder) {
              parentOrder.items = await OrderItem.findAll({ where: { orderId: itemOrderId }, transaction: t });
              const isReady = parentOrder.items.every(item => item.id === production.orderItemId || item.status === 'ready');
              console.log(`parentOrder.items count: ${parentOrder.items.length}. Every item ready? ${isReady}`);
              
              if (isReady) {
                await parentOrder.update({ status: 'ready' }, { transaction: t });
                console.log(`Parent Order #${parentOrder.id} UPDATE to 'ready' Executed!`);
              }
            } else {
               console.log("Parent order not found!");
            }
         }
      }
    }

    // Do NOT commit, we are just testing!
    await t.rollback();
    console.log("Test execution finished (rolled back).");
    process.exit(0);
  } catch(err) {
    console.error(err);
    await t.rollback();
  }
}

testReady();
