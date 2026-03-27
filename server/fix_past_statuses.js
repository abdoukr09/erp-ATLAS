const sequelize = require('./config/database');
const { Order, OrderItem, Production } = require('./models');

async function fix() {
  await sequelize.sync();
  
  const orders = await Order.findAll({ include: [{ model: OrderItem, as: 'items' }] });
  
  let fixed = 0;
  for (const o of orders) {
    if (!o.items || o.items.length === 0) continue;
    
    // If order was already delivered or cancelled, skip
    if (o.status === 'delivered' || o.status === 'cancelled') continue;
    
    const allReady = o.items.every(i => i.status === 'ready');
    const anyInProd = o.items.some(i => i.status === 'in_production' || i.status === 'ready' || i.status === 'completed');
    const allPending = o.items.every(i => i.status === 'pending');
    
    let expectedStatus = o.status;
    if (allReady) expectedStatus = 'ready';
    else if (anyInProd && !allReady) expectedStatus = 'in_production';
    else if (allPending) expectedStatus = 'pending';
    
    if (o.status !== expectedStatus) {
      console.log(`Order #${o.id} migrating from ${o.status} to ${expectedStatus}`);
      await o.update({ status: expectedStatus });
      fixed++;
    }
  }
  
  console.log(`Migration complete. Fixed ${fixed} old orders.`);
}
fix();
