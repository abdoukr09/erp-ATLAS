/**
 * Concurrency Stress Test — validates row-level locking
 * Tests: simultaneous payments on same order
 */
const http = require('http');
require('dotenv').config();
const PORT = process.env.PORT || 5001;
let TOKEN = null;

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost', port: PORT, path,
      method, headers: { 'Content-Type': 'application/json' }
    };
    if (TOKEN) options.headers['Authorization'] = `Bearer ${TOKEN}`;
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('\n============================================');
  console.log('  CONCURRENCY STRESS TEST');
  console.log('============================================\n');

  // Login
  const login = await request('POST', '/api/auth/login', { username: 'admin', password: 'admin123' });
  TOKEN = login.data.token;

  // Get customers + models for test order
  const customers = await request('GET', '/api/customers');
  const models = await request('GET', '/api/product-models');
  if (!customers.data?.length || !models.data?.length) {
    console.log('⛔ Need customers and models'); process.exit(1);
  }

  // Create a test order worth 100,000 DA
  const orderRes = await request('POST', '/api/orders', {
    customerId: customers.data[0].id,
    orderDate: '2026-03-21',
    items: [{ sofaModel: models.data[0].name, quantity: 1, unitPrice: 100000, discountPercentage: 0 }],
    salesmen: []
  });
  if (orderRes.status !== 201) {
    console.log('⛔ Order creation failed:', orderRes.data); process.exit(1);
  }
  const testOrderId = orderRes.data.id;
  console.log(`✅ Test order created: #${testOrderId} (100,000 DA)\n`);

  // ─── TEST 1: 5 simultaneous payments of 20,000 DA each ───
  console.log('── TEST 1: 5 simultaneous payments of 20,000 DA ──');
  const paymentPromises = [];
  for (let i = 0; i < 5; i++) {
    paymentPromises.push(request('POST', '/api/payments', {
      orderId: testOrderId,
      amount: 20000,
      method: 'cash',
      type: 'advance',
      paymentDate: '2026-03-21'
    }));
  }

  const paymentResults = await Promise.all(paymentPromises);
  const successCount = paymentResults.filter(r => r.status === 201).length;
  console.log(`   Payments submitted: 5, Succeeded: ${successCount}`);

  // Check the order state
  const orderCheck = await request('GET', `/api/orders/${testOrderId}`);
  const orderData = orderCheck.data;
  const remaining = Number(orderData.remainingPayment || 0);
  const paymentStatus = orderData.paymentStatus;
  const totalPayments = orderData.payments?.reduce((s, p) => s + Number(p.amount), 0) || 0;

  console.log(`   Total Payments Sum: ${totalPayments.toLocaleString()} DA`);
  console.log(`   Remaining Payment: ${remaining.toLocaleString()} DA`);
  console.log(`   Payment Status: ${paymentStatus}`);

  const expectedRemaining = 100000 - (successCount * 20000);
  if (remaining === expectedRemaining) {
    console.log(`   ✅ PASS — Remaining (${remaining}) matches expected (${expectedRemaining})`);
  } else {
    console.log(`   ❌ FAIL — Remaining (${remaining}) != expected (${expectedRemaining})`);
  }

  if (successCount === 5 && paymentStatus === 'fully_paid') {
    console.log('   ✅ PASS — All 5 payments succeeded and order is fully_paid');
  } else if (successCount === 5) {
    console.log(`   ⚠️  All 5 succeeded but status is "${paymentStatus}" instead of "fully_paid"`);
  }

  // ─── CLEANUP ───
  console.log('\n── CLEANUP ──');
  const delRes = await request('DELETE', `/api/orders/${testOrderId}`);
  console.log(`   Order #${testOrderId} deleted: ${delRes.status === 200 ? '✅' : '❌'}`);

  console.log('\n============================================');
  console.log('  STRESS TEST COMPLETE');
  console.log('============================================\n');
  process.exit(0);
}

run();
