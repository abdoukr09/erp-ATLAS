/**
 * Comprehensive ERP Application Test Suite
 * Tests all API endpoints and data flows
 */
const http = require('http');
require('dotenv').config();

const PORT = process.env.PORT || 5001;
const BASE = `http://localhost:${PORT}`;
let TOKEN = null;
let results = { pass: 0, fail: 0, errors: [] };

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const options = {
      hostname: url.hostname, port: url.port, path: url.pathname + url.search,
      method, headers: { 'Content-Type': 'application/json' }
    };
    if (TOKEN) options.headers['Authorization'] = `Bearer ${TOKEN}`;
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function test(name, passed, detail = '') {
  if (passed) { results.pass++; console.log(`  ✅ ${name}`); }
  else { results.fail++; results.errors.push({ name, detail }); console.log(`  ❌ ${name} → ${detail}`); }
}

async function run() {
  console.log('\n========================================');
  console.log('  ERP CANAPE - FULL TEST SUITE');
  console.log('========================================\n');

  // ─── 1. AUTH ───
  console.log('── 1. AUTHENTICATION ──');
  try {
    const login = await request('POST', '/api/auth/login', { username: 'admin', password: 'admin123' });
    test('Login returns 200', login.status === 200, `Status: ${login.status}`);
    const receivedToken = login.data?.accessToken || login.data?.token;
    test('Login returns token', !!receivedToken, 'No token received');
    if (receivedToken) TOKEN = receivedToken;
    else { console.log('⛔ Cannot continue without token'); process.exit(1); }
  } catch (err) { test('Login request', false, err.message); process.exit(1); }

  // ─── 2. DASHBOARD ───
  console.log('\n── 2. DASHBOARD ──');
  try {
    const dash = await request('GET', '/api/dashboard/stats');
    test('Dashboard returns 200', dash.status === 200, `Status: ${dash.status} ${JSON.stringify(dash.data).substring(0,100)}`);
    test('Dashboard has stats', !!dash.data?.stats, 'Missing stats object');
    test('Dashboard has recentOrders', Array.isArray(dash.data?.recentOrders), 'recentOrders not array');
    test('Dashboard has monthlyRevenue', Array.isArray(dash.data?.monthlyRevenue), 'monthlyRevenue not array');
    test('Dashboard has lowStockMaterials', Array.isArray(dash.data?.lowStockMaterials), 'lowStockMaterials not array');
  } catch (err) { test('Dashboard request', false, err.message); }

  // ─── 3. CUSTOMERS ───
  console.log('\n── 3. CUSTOMERS ──');
  try {
    const customers = await request('GET', '/api/customers');
    test('Customers list returns 200', customers.status === 200, `Status: ${customers.status}`);
    test('Customers is array', Array.isArray(customers.data), 'Not array');
    const custCount = customers.data?.length || 0;
    console.log(`     (${custCount} customers found)`);
  } catch (err) { test('Customers request', false, err.message); }

  // ─── 4. PRODUCT MODELS ───
  console.log('\n── 4. PRODUCT MODELS (Catalogue) ──');
  try {
    const models = await request('GET', '/api/product-models');
    test('Product Models returns 200', models.status === 200, `Status: ${models.status}`);
    test('Product Models is array', Array.isArray(models.data), 'Not array');
    const modelCount = models.data?.length || 0;
    console.log(`     (${modelCount} models found)`);
    if (modelCount > 0) {
      const m = models.data[0];
      test('Model has name', !!m.name, 'Missing name');
      test('Model has stock field', m.stock !== undefined, 'Missing stock');
    }
  } catch (err) { test('Product Models request', false, err.message); }

  // ─── 5. MATERIALS ───
  console.log('\n── 5. MATERIALS (Inventory) ──');
  try {
    const mats = await request('GET', '/api/materials');
    test('Materials returns 200', mats.status === 200, `Status: ${mats.status}`);
    test('Materials is array', Array.isArray(mats.data), 'Not array');
    const matCount = mats.data?.length || 0;
    console.log(`     (${matCount} materials found)`);
  } catch (err) { test('Materials request', false, err.message); }

  // ─── 6. EMPLOYEES ───
  console.log('\n── 6. EMPLOYEES ──');
  try {
    const emps = await request('GET', '/api/employees');
    test('Employees returns 200', emps.status === 200, `Status: ${emps.status}`);
    test('Employees is array', Array.isArray(emps.data), 'Not array');
    const empCount = emps.data?.length || 0;
    console.log(`     (${empCount} employees found)`);
  } catch (err) { test('Employees request', false, err.message); }

  // ─── 7. ORDERS ───
  console.log('\n── 7. ORDERS ──');
  try {
    const orders = await request('GET', '/api/orders');
    test('Orders returns 200', orders.status === 200, `Status: ${orders.status}`);
    test('Orders is array', Array.isArray(orders.data), 'Not array');
    const orderCount = orders.data?.length || 0;
    console.log(`     (${orderCount} orders found)`);
    if (orderCount > 0) {
      const o = orders.data[0];
      test('Order has customer', !!o.customer, 'Missing customer include');
      test('Order has items', Array.isArray(o.items), 'Missing items include');
      test('Order has salesmen', Array.isArray(o.salesmen), 'Missing salesmen include');
      if (o.items?.length > 0) {
        test('OrderItem has sofaModel', !!o.items[0].sofaModel, 'Item missing sofaModel');
        test('OrderItem has quantity', o.items[0].quantity !== undefined, 'Item missing quantity');
      }
    }
  } catch (err) { test('Orders request', false, err.message); }

  // ─── 8. PRODUCTION ───
  console.log('\n── 8. PRODUCTION ──');
  try {
    const prod = await request('GET', '/api/production');
    test('Production returns 200', prod.status === 200, `Status: ${prod.status} ${JSON.stringify(prod.data).substring(0,100)}`);
    test('Production is array', Array.isArray(prod.data), 'Not array');
    const prodCount = prod.data?.length || 0;
    console.log(`     (${prodCount} production records found)`);
    if (prodCount > 0) {
      const p = prod.data[0];
      test('Production has workerAssignments', Array.isArray(p.workerAssignments), 'Missing workerAssignments');
      test('Production has status', !!p.status, 'Missing status');
    }
  } catch (err) { test('Production request', false, err.message); }

  // ─── 9. DELIVERIES ───
  console.log('\n── 9. DELIVERIES ──');
  try {
    const del = await request('GET', '/api/deliveries');
    test('Deliveries returns 200', del.status === 200, `Status: ${del.status}`);
    test('Deliveries is array', Array.isArray(del.data), 'Not array');
    const delCount = del.data?.length || 0;
    console.log(`     (${delCount} deliveries found)`);
    if (delCount > 0) {
      const d = del.data[0];
      test('Delivery has order', !!d.order, 'Missing order include');
      test('Delivery order has items', d.order && Array.isArray(d.order.items), 'Order missing items');
    }
  } catch (err) { test('Deliveries request', false, err.message); }

  // ─── 10. PAYMENTS ───
  console.log('\n── 10. PAYMENTS (Finance) ──');
  try {
    const pay = await request('GET', '/api/payments');
    test('Payments returns 200', pay.status === 200, `Status: ${pay.status}`);
    test('Payments is array', Array.isArray(pay.data), 'Not array');
    const payCount = pay.data?.length || 0;
    console.log(`     (${payCount} payments found)`);
    if (payCount > 0) {
      const p = pay.data[0];
      test('Payment has order', !!p.order, 'Missing order include');
      test('Payment order has items', p.order && Array.isArray(p.order.items), 'Order missing items');
      test('Payment order has customer', p.order && !!p.order.customer, 'Order missing customer');
    }
  } catch (err) { test('Payments request', false, err.message); }

  // ─── 11. EMPLOYEE PERFORMANCE ───
  console.log('\n── 11. EMPLOYEE PERFORMANCE ──');
  try {
    const emps = await request('GET', '/api/employees');
    if (emps.data?.length > 0) {
      const empId = emps.data[0].id;
      const month = '2026-03';
      const perf = await request('GET', `/api/employees/${empId}/performance?month=${month}`);
      test('Performance returns 200', perf.status === 200, `Status: ${perf.status} ${JSON.stringify(perf.data).substring(0,150)}`);
      test('Performance has productions', Array.isArray(perf.data?.productions), 'Missing productions');
      test('Performance has sales', Array.isArray(perf.data?.sales), 'Missing sales');
    } else { console.log('     (No employees to test performance)'); }
  } catch (err) { test('Performance request', false, err.message); }

  // ─── 12. FINISHED PRODUCTS ───
  console.log('\n── 12. FINISHED PRODUCTS ──');
  try {
    const fin = await request('GET', '/api/orders');
    const readyOrders = fin.data?.filter(o => o.status === 'ready' || o.status === 'delivered') || [];
    test('FinishedProducts filter works', Array.isArray(readyOrders), 'Filter failed');
    console.log(`     (${readyOrders.length} ready/delivered orders)`);
    if (readyOrders.length > 0) {
      const ro = readyOrders[0];
      test('Ready order has items', Array.isArray(ro.items), 'Missing items');
    }
  } catch (err) { test('FinishedProducts request', false, err.message); }

  // ─── 13. CROSS-MODULE: ORDER CREATION FLOW ───
  console.log('\n── 13. ORDER CREATION FLOW ──');
  try {
    const customers = await request('GET', '/api/customers');
    const models = await request('GET', '/api/product-models');
    if (customers.data?.length > 0 && models.data?.length > 0) {
      const testOrder = {
        customerId: customers.data[0].id,
        orderDate: '2026-03-20',
        items: [{
          sofaModel: models.data[0].name,
          quantity: 1,
          unitPrice: 50000,
          discountPercentage: 0
        }],
        salesmen: []
      };
      const created = await request('POST', '/api/orders', testOrder);
      test('Order creation returns 201', created.status === 201, `Status: ${created.status} ${JSON.stringify(created.data).substring(0,150)}`);
      if (created.status === 201) {
        const orderId = created.data?.id;
        test('Created order has ID', !!orderId, 'No ID returned');

        // Clean up: delete the test order
        if (orderId) {
          const del = await request('DELETE', `/api/orders/${orderId}`);
          test('Test order cleanup', del.status === 200 || del.status === 204, `Cleanup status: ${del.status}`);
        }
      }
    } else { console.log('     (No customers/models to test creation)'); }
  } catch (err) { test('Order creation flow', false, err.message); }

  // ─── SUMMARY ───
  console.log('\n========================================');
  console.log(`  RESULTS: ${results.pass} passed, ${results.fail} failed`);
  console.log('========================================');
  if (results.errors.length > 0) {
    console.log('\n🔴 FAILURES:');
    results.errors.forEach((e, i) => console.log(`  ${i+1}. ${e.name}: ${e.detail}`));
  } else {
    console.log('\n🟢 ALL TESTS PASSED!');
  }
  console.log('');
  process.exit(results.fail > 0 ? 1 : 0);
}

run();
