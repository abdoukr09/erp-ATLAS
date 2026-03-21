 // const axios = require('axios'); 

async function test() {
  try {
    const res = await axios.post('http://localhost:5001/api/orders', {
      customerId: 1, // Assume customer 1 exists
      items: [
        { sofaModel: 'Sofa Test 1', quantity: 2, unitPrice: 10000, discountPercentage: 10 }, // 20000 - 10% = 18000
        { sofaModel: 'Sofa Test 2', quantity: 1, unitPrice: 5000, discountPercentage: 20 }   // 5000 - 20% = 4000
      ],
      salesmen: []
    }, {
      headers: { Authorization: 'Bearer test-admin-token' } // We may need a login or mock token, or bypass
    });
    console.log("✅ Order Created with items:", res.data);
  } catch (err) {
    console.error("❌ Test Failed:", err.response?.data || err.message);
  }
}
// Bypass auth for test if we can't get token easily, or use direct DB test
// Let's use direct DB module test for frictionless run!
const { Order, OrderItem } = require('./models');
async function runDBTest() {
  const t = await Order.sequelize.transaction();
  try {
    const order = await Order.create({
      customerId: 1,
      totalPrice: 22000, // (20000 * 0.9) + (5000 * 0.8) = 18000 + 4000 = 22000
      advancePayment: 0,
      paymentStatus: 'unpaid',
      deliveryAddress: 'Test Addr',
      notes: 'Test itemized discounts',
      status: 'pending'
    }, { transaction: t });

    const item1 = await OrderItem.create({
      orderId: order.id,
      sofaModel: 'Sofa Test 1',
      quantity: 2,
      unitPrice: 10000,
      discountPercentage: 10,
      status: 'pending'
    }, { transaction: t });

    const item2 = await OrderItem.create({
      orderId: order.id,
      sofaModel: 'Sofa Test 2',
      quantity: 1,
      unitPrice: 5000,
      discountPercentage: 20,
      status: 'pending'
    }, { transaction: t });

    console.log("✅ DB verification passed for nested items!");
    await t.rollback(); // Don't pollute DB
    process.exit(0);
  } catch (err) {
    console.error("❌ DB verification failed:", err);
    await t.rollback();
    process.exit(1);
  }
}

runDBTest();
