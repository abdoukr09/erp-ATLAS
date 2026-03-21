const { Production, OrderItem, Order, Customer, ProductModel, Delivery } = require('./models');

async function run() {
  try {
    console.log("=== Testing Production.findAll ===");
    const productions = await Production.findAll({
      include: [
        { 
          model: OrderItem, 
          as: 'orderItem', 
          attributes: ['id', 'sofaModel', 'quantity', 'status'], 
          include: [{ 
            model: Order, 
            as: 'order', 
            attributes: ['id', 'status'], 
            include: [{ model: Customer, as: 'customer', attributes: ['name'] }] 
          }] 
        },
        { model: ProductModel, as: 'productModel', attributes: ['id', 'name'] }
      ],
    });
    console.log("✅ Production list loaded safely! Count:", productions.length);
  } catch (err) {
    console.error("❌ Production.findAll Failed:", err);
  }

  try {
    console.log("\n=== Testing Delivery.findAll (Fallback) ===");
    const deliveries = await Delivery.findAll({
       include: [{ model: Order, as: 'order' }] // Simple fallback to check connection
    });
    console.log("✅ Delivery basic list loaded safely! Count:", deliveries.length);
  } catch (err) {
    console.error("❌ Delivery.findAll Failed:", err);
  }

  process.exit();
}

run();
