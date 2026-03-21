const { Customer, ProductModel, Employee, Material, Order } = require('./models');

async function run() {
  try {
    const customers = await Customer.findAll({ limit: 5 });
    const models = await ProductModel.findAll({ limit: 5 });
    const employees = await Employee.findAll({ limit: 5 });
    const materials = await Material.findAll({ limit: 5 });
    const orders = await Order.findAll({ limit: 5 });

    console.log("=== CUSTOMERS ===");
    customers.forEach(c => console.log(`ID: ${c.id} | Name: ${c.name}`));

    console.log("\n=== MODELS ===");
    models.forEach(m => console.log(`ID: ${m.id} | Name: ${m.name} | Stock: ${m.stock}`));

    console.log("\n=== EMPLOYEES ===");
    employees.forEach(e => console.log(`ID: ${e.id} | Name: ${e.name} | Category: ${e.category}`));

    console.log("\n=== MATERIALS ===");
    materials.forEach(m => console.log(`ID: ${m.id} | name: ${m.name} | Stock: ${m.stock}`));

    console.log("\n=== ORDERS ===");
    orders.forEach(o => console.log(`ID: ${o.id} | Price: ${o.totalPrice} | Status: ${o.status}`));

  } catch (err) {
    console.error("❌ Inspection Failed:", err);
  } finally {
    process.exit();
  }
}

run();
