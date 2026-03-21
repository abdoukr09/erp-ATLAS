const { Production, OrderItem, Order, Customer, ProductModel, ProductionWorker, Employee } = require('./models');

async function run() {
  try {
    console.log("=== Testing Production.findAll WITH FULL Includes ===");
    const productions = await Production.findAll({
      include: [
        { 
          model: OrderItem, as: 'orderItem', attributes: ['id', 'sofaModel', 'quantity', 'status'], 
          include: [{ 
            model: Order, as: 'order', attributes: ['id', 'status'], 
            include: [{ model: Customer, as: 'customer', attributes: ['name'] }] 
          }] 
        },
        { model: ProductModel, as: 'productModel', attributes: ['id', 'name'] },
        { model: ProductionWorker, as: 'workerAssignments', include: [{ model: Employee, as: 'worker', attributes: ['id', 'name'] }] }
      ],
    });
    console.log("✅ Production list loaded safely! Count:", productions.length);
  } catch (err) {
    console.error("❌ Production.findAll Failed:", err);
  }
  process.exit();
}

run();
