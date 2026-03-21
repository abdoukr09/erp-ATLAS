const { OrderItem, OrderSalesman, Production } = require('./models');
const sequelize = require('./config/database');

async function sync() {
  try {
    console.log("Synchronizing new models with database...");
    
    // 1. Create new tables
    await OrderItem.sync({ alter: true });
    console.log("✅ OrderItem table synced.");

    await OrderSalesman.sync({ alter: true });
    console.log("✅ OrderSalesman table synced.");

    // 2. Add column to productions
    console.log("Adding orderItemId to productions...");
    await sequelize.query('ALTER TABLE "productions" ADD COLUMN IF NOT EXISTS "orderItemId" INTEGER REFERENCES "order_items" ("id") ON DELETE SET NULL');
    console.log("✅ Column 'orderItemId' added successfully.");

    console.log("🚀 All structure synced correctly.");
  } catch (e) {
    console.error("❌ Sync failed:", e.message);
  } finally {
    process.exit();
  }
}
sync();
