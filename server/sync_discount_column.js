const { OrderItem } = require('./models');
async function run() {
  try {
    await OrderItem.sync({ alter: true });
    console.log("✅ OrderItem altered with discountPercentage!");
  } catch (e) {
    console.error(e);
  } finally {
    process.exit();
  }
}
run();
