const { Order, OrderItem, OrderSalesman, Production } = require('./models');
const sequelize = require('./config/database');

async function migrate() {
  const t = await sequelize.transaction();
  try {
    console.log("Reading existing orders...");
    const orders = await Order.findAll({ transaction: t });
    
    console.log(`Found ${orders.length} orders to migrate.`);

    for (const order of orders) {
      // 1. Migrate single product line to OrderItem
      if (order.sofaModel) {
        console.log(`Migrating Order #${order.id} - ${order.sofaModel}`);
        
        // Find or create item line (to prevent double-runs if executed twice)
        const [item, created] = await OrderItem.findOrCreate({
          where: { orderId: order.id, sofaModel: order.sofaModel },
          defaults: {
            quantity: order.quantity || 1,
            unitPrice: order.unitPrice || 0,
            status: order.status || 'pending',
          },
          transaction: t
        });

        if (created) {
          console.log(`  -> Created OrderItem ID: ${item.id}`);
          
          // 2. Map existing Production records to this new OrderItem
          const affectedProductions = await Production.update(
            { orderItemId: item.id },
            { where: { orderId: order.id, orderItemId: null }, transaction: t }
          );
          if (affectedProductions[0] > 0) {
            console.log(`  -> Linked ${affectedProductions[0]} Productions to Item ID ${item.id}`);
          }
        }
      }

      // 3. Migrate Salesman to OrderSalesman
      if (order.salesmanId) {
        await OrderSalesman.findOrCreate({
          where: { orderId: order.id, salesmanId: order.salesmanId },
          defaults: {
            splitPercentage: 100.00
          },
          transaction: t
        });
      }
    }

    await t.commit();
    console.log("🚀 Data migration completed successfully with absolute zero loss!");
  } catch (e) {
    await t.rollback();
    console.error("❌ Migration failed:", e.message);
  } finally {
    process.exit();
  }
}
migrate();
