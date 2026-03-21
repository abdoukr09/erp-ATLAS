const http = require('http');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const token = jwt.sign({ id: 1, role: 'admin' }, process.env.JWT_SECRET || 'secret');

function testEndpoint(path, callback) {
  const options = {
    hostname: 'localhost',
    port: 5001,
    path: path,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      console.log(`\n=== Testing ${path} ===`);
      console.log(`STATUS: ${res.statusCode}`);
      if (res.statusCode !== 200) {
        console.log(`BODY: ${data}`);
      } else {
        console.log(`BODY: Success (Length: ${data.length})`);
      }
      if (callback) callback();
    });
  });

  req.on('error', (e) => {
    console.error(`problem with request ${path}: ${e.message}`);
    if (callback) callback();
  });

  req.end();
}

testEndpoint('/api/production', () => {
  testEndpoint('/api/deliveries', () => {
     process.exit();
  });
});
