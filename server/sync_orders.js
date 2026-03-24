const { Order, OrderItem } = require('./models');

async function syncOrders() {
  try {
    const orders = await Order.findAll({
      include: [{ model: OrderItem, as: 'items' }],
      where: { status: ['pending', 'in_production'] }
    });

    for (const o of orders) {
      if (o.items && o.items.length > 0) {
        const allReady = o.items.every(i => i.status === 'ready' || i.status === 'delivered');
        if (allReady) {
          console.log(`Fixing stuck Order #${o.id} -> state should be ready.`);
          await o.update({ status: 'ready' });
        }
      }
    }
    console.log("Sync complete.");
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

syncOrders();
