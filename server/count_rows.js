const { Order, Customer, Material, Production, Payment } = require('./models');
const sequelize = require('./config/database');

async function run() {
  try {
    await sequelize.authenticate();
    const orders = await Order.count();
    const customers = await Customer.count();
    const materials = await Material.count();
    const productions = await Production.count();
    const payments = await Payment.count();

    console.log('\n=== DB ROW COUNTS ===');
    console.log(`Orders: ${orders}`);
    console.log(`Customers: ${customers}`);
    console.log(`Materials: ${materials}`);
    console.log(`Productions: ${productions}`);
    console.log(`Payments: ${payments}`);
    console.log('=====================\n');
    process.exit(0);
  } catch (err) {
    console.error('Error counting rows:', err);
    process.exit(1);
  }
}
run();
