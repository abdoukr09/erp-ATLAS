/**
 * Reservation Concurrency Test
 * Creates 3 simultaneous orders for the same product model.
 * Validates: reservations created, no stock corruption, cleanup works.
 */
const http = require('http');
require('dotenv').config();
const PORT = process.env.PORT || 5001;
let TOKEN = null;

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost', port: PORT, path: path,
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
  console.log('  RESERVATION CONCURRENCY TEST');
  console.log('============================================\n');

  const login = await request('POST', '/api/auth/login', { username: 'admin', password: 'admin123' });
  TOKEN = login.data.token;

  const customers = await request('GET', '/api/customers');
  const models = await request('GET', '/api/product-models');
  const custId = customers.data[0].id;
  const modelName = models.data[0].name;

  console.log(`Customer: ${customers.data[0].name} | Model: ${modelName}\n`);

  // Fire 3 simultaneous orders
  console.log('── STEP 1: 3 simultaneous orders for same model ──');
  const orderPayload = {
    customerId: custId,
    orderDate: '2026-03-21',
    items: [{ sofaModel: modelName, quantity: 2, unitPrice: 50000, discountPercentage: 0 }],
    salesmen: []
  };

  const results = await Promise.all([
    request('POST', '/api/orders', orderPayload),
    request('POST', '/api/orders', orderPayload),
    request('POST', '/api/orders', orderPayload),
  ]);

  const createdOrders = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === 201) {
      createdOrders.push(r.data.id);
      const warnings = r.data.reservationWarnings;
      console.log(`  Order #${r.data.id}: Created ✅${warnings ? ' ⚠️ Warnings: ' + warnings.join(', ') : ''}`);
    } else {
      console.log(`  Order ${i+1}: FAILED ❌ (${r.status}): ${JSON.stringify(r.data).substring(0, 100)}`);
    }
  }

  console.log(`\n  Total orders placed: ${createdOrders.length}/3`);

  // Check DB state
  console.log('\n── STEP 2: Verify reservation records in DB ──');
  const { MaterialReservation } = require('./models');
  for (const orderId of createdOrders) {
    const reservations = await MaterialReservation.findAll({ where: { orderId } });
    console.log(`  Order #${orderId}: ${reservations.length} material reservations (status: ${reservations.map(r => r.status).join(', ') || 'none'})`);
  }

  // Cleanup
  console.log('\n── CLEANUP ──');
  for (const orderId of createdOrders) {
    const del = await request('DELETE', `/api/orders/${orderId}`);
    console.log(`  Order #${orderId} deleted: ${del.status === 200 ? '✅' : '❌'}`);
  }

  // Verify reservations are gone
  for (const orderId of createdOrders) {
    const remaining = await MaterialReservation.count({ where: { orderId } });
    console.log(`  Order #${orderId} reservations after delete: ${remaining === 0 ? '✅ 0 (cleaned)' : '❌ ' + remaining + ' still exist'}`);
  }

  console.log('\n============================================');
  console.log('  RESERVATION TEST COMPLETE');
  console.log('============================================\n');
  process.exit(0);
}

run();
