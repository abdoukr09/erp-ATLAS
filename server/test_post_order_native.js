const http = require('http');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const token = jwt.sign({ id: 1, role: 'admin' }, process.env.JWT_SECRET || 'secret');

const postData = JSON.stringify({
  customerId: 4,
  items: [
    { sofaModel: 'fauteuille 3p lemon taupe', quantity: 1, unitPrice: 10000, discountPercentage: 0 }
  ],
  salesmen: []
});

const options = {
  hostname: 'localhost',
  port: 5001,
  path: '/api/orders',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'Authorization': `Bearer ${token}`
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
    console.log(`BODY: ${data}`);
    process.exit();
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
  process.exit();
});

req.write(postData);
req.end();
