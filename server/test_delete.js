const { Employee, Order, OrderSalesman } = require('./models');

async function testDelete() {
  try {
    const ts = Date.now().toString();
    // 1. Create a dummy employee
    const emp = await Employee.create({ name: 'Delete Test ' + ts, category: 'vendeur' });
    console.log('Created employee', emp.id);

    // 2. Create a dummy order
    // Requires a customerId, we'll just pick the first existing one
    const cust = await require('./models/Customer').findOne();
    if (!cust) throw new Error('No customers found');

    const order = await Order.create({
      customerId: cust.id,
      totalPrice: 100,
      salesmanId: emp.id // Assign directly
    });
    console.log('Created order', order.id);

    // 3. Assign via junction table
    await OrderSalesman.create({ orderId: order.id, salesmanId: emp.id, splitPercentage: 100 });
    console.log('Created order salesman junction');

    // 4. TRY TO DELETE EMPLOYEE
    console.log('Attempting delete...');
    await Employee.destroy({ where: { id: emp.id } });
    console.log('SUCCESSFULLY DELETED!');
  } catch (err) {
    console.error('DELETE FAILED:', err.name);
    if (err.parent) console.error(err.parent.message);
  } finally {
    process.exit(0);
  }
}
testDelete();
