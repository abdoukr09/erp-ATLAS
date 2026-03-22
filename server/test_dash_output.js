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
  const login = await request('POST', '/api/auth/login', { username: 'admin', password: 'admin123' });
  TOKEN = login.data.token;

  const dash = await request('GET', '/api/dashboard/stats');
  console.log('\n=== DASHBOARD STATS RESPONSE ===');
  console.log(JSON.stringify(dash.data, null, 2));
  console.log('=================================\n');
  process.exit(0);
}
run();
