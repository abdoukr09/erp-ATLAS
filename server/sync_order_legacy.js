const { Order } = require('./models');
async function run() {
  try {
    await Order.sync({ alter: true });
    console.log("✅ Order altered safely to relax legacy fields!");
  } catch (e) {
    console.error(e);
  } finally {
    process.exit();
  }
}
run();
