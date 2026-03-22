async function testBug() {
  const baseUrl = 'http://localhost:5001/api';
  try {
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const loginData = await loginRes.json();
    const token = loginData.token || loginData.accessToken;
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

    const cRes = await fetch(`${baseUrl}/customers`, { method: 'POST', headers, body: JSON.stringify({ name: 'wallid', phone: '' }) });
    const cData = await cRes.json();
    
    const eRes = await fetch(`${baseUrl}/employees`, { method: 'POST', headers, body: JSON.stringify({ name: 'aymn', category: 'vendeur' }) });
    const eData = await eRes.json();

    const orderRes = await fetch(`${baseUrl}/orders`, {
      method: 'POST', headers,
      body: JSON.stringify({
        customerId: cData.id,
        items: [
          { sofaModel: 'canape 1p', quantity: 2, unitPrice: 0, discountPercentage: 0, color: '' },
          { sofaModel: 'canape 3p', quantity: 1, unitPrice: 0, discountPercentage: 0, color: '' },
          { sofaModel: 'canape 2p', quantity: 1, unitPrice: 0, discountPercentage: 0, color: '' },
          { sofaModel: 'salon L goya', quantity: 1, unitPrice: 0, discountPercentage: 0, color: '' }
        ],
        salesmen: [
          { salesmanId: eData.id, splitPercentage: 100 }
        ],
        deliveryAddress: '',
        notes: '',
        status: 'pending',
        advancePayment: '',
        paymentMethod: 'cash',
        useStock: false,
        discountPercentage: 0,
        totalPrice: 1200000
      })
    });
    
    if (orderRes.ok) {
      console.log('SUCCESS! Order created:', (await orderRes.json()).id);
    } else {
      console.log('ERROR STATUS:', orderRes.status);
      console.error(await orderRes.json());
    }
  } catch (err) {
    console.error('Network Error:', err.message);
  }
}
testBug();
