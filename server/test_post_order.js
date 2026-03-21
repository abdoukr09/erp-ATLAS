const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function run() {
  try {
    const token = jwt.sign({ id: 1, role: 'admin' }, process.env.JWT_SECRET || 'secret');
    console.log("Using token:", token);

    const res = await axios.post('http://localhost:5000/api/orders', {
      customerId: 4, 
      items: [
        { sofaModel: 'fauteuille 3p lemon taupe', quantity: 1, unitPrice: 10000, discountPercentage: 0 }
      ],
      salesmen: []
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log("✅ Success response:", res.data);
  } catch (err) {
    console.error("❌ Response Error Data:", err.response?.data);
    console.error("❌ Response Status:", err.response?.status);
  } finally {
    process.exit();
  }
}

run();
