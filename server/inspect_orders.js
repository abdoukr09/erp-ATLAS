const { Order, OrderItem, Production } = require('./models');

async function inspect() {
  try {
    const orders = await Order.findAll({
      include: [
        { model: OrderItem, as: 'items' }
      ]
    });
    
    for (const o of orders) {
      console.log(`Order #${o.id} - Status: ${o.status}`);
      for (const i of o.items) {
         console.log(`  -> Item #${i.id}: Model=${i.sofaModel}, Status=${i.status}`);
         const prods = await Production.findAll({ where: { orderItemId: i.id } });
         for (const p of prods) {
            console.log(`     -> Prod Task #${p.id}: Status=${p.status}`);
         }
      }
    }
  } catch(e) { console.error(e); }
  process.exit(0);
}
inspect();
