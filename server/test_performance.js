/**
 * Fix: re-test employee performance with correct query param encoding
 */
const http = require('http');
require('dotenv').config();

const PORT = process.env.PORT || 5001;
let TOKEN = null;

function request(method, fullPath, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost', port: PORT, path: fullPath,
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
  // Login
  const login = await request('POST', '/api/auth/login', { username: 'admin', password: 'admin123' });
  TOKEN = login.data.token;

  // Get employees
  const emps = await request('GET', '/api/employees');
  if (!emps.data?.length) { console.log('No employees'); process.exit(); }

  const empId = emps.data[0].id;
  console.log(`Testing performance for employee ${empId} (${emps.data[0].name})...`);
  
  const perf = await request('GET', `/api/employees/${empId}/performance?month=2026-03`);
  console.log(`Status: ${perf.status}`);
  console.log(`Data:`, JSON.stringify(perf.data, null, 2).substring(0, 500));
  
  if (perf.status === 200) {
    console.log(`✅ Performance endpoint works`);
    console.log(`   Productions: ${perf.data.productions?.length || 0}`);
    console.log(`   Sales: ${perf.data.sales?.length || 0}`);
  } else {
    console.log(`❌ Performance endpoint failed: ${perf.data?.error || 'Unknown error'}`);
  }

  process.exit();
}
run();
