const { ProductionWorker } = require('./models');

async function run() {
  try {
    console.log("Syncing ProductionWorker model...");
    await ProductionWorker.sync({ alter: true });
    console.log("✅ ProductionWorker table synced successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Sync failed:", err);
    process.exit(1);
  }
}

run();
