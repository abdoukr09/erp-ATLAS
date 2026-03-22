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

    // Fetch the latest order
    const getRes = await fetch(`${baseUrl}/orders`, { headers });
    const orders = await getRes.json();
    const lastOrder = orders[orders.length - 1];

    if (!lastOrder) {
      console.log('No orders to edit');
      return;
    }

    console.log('Modifying order', lastOrder.id);

    const orderRes = await fetch(`${baseUrl}/orders/${lastOrder.id}`, {
      method: 'PUT', headers,
      body: JSON.stringify({
        customerId: lastOrder.customerId,
        items: lastOrder.items || [],
        salesmen: lastOrder.salesmen ? lastOrder.salesmen.map(s => ({ salesmanId: s.salesmanId, splitPercentage: s.splitPercentage })) : [],
        deliveryAddress: '',
        notes: '',
        status: 'pending',
        advancePayment: '',
        paymentMethod: 'cash',
        useStock: false,
        discountPercentage: 10,
        totalPrice: 1500000
      })
    });
    
    if (orderRes.ok) {
      console.log('SUCCESS! Order updated:', lastOrder.id);
    } else {
      console.log('ERROR STATUS:', orderRes.status);
      console.error(await orderRes.json());
    }
  } catch (err) {
    console.error('Network Error:', err.message);
  }
}
testBug();
