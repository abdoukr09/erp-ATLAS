async function testPayment() {
  try {
    // 1. authenticate
    console.log("Authenticating...");
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'password123' })
    });
    let loginData = await loginRes.json();
    if (!loginRes.ok) {
       // try admin123
       const loginRes2 = await fetch('http://localhost:5000/api/auth/login', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ username: 'admin', password: 'admin123' })
       });
       loginData = await loginRes2.json();
    }
    const token = loginData.token;

    // 2. get first employee
    console.log("Fetching employees...");
    const empRes = await fetch('http://localhost:5000/api/employees', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const employees = await empRes.json();
    if (!employees || employees.length === 0) {
      console.log("No employees found to test payment on.");
      return;
    }
    const targetEmpId = employees[0].id;
    
    // 3. post payment
    console.log(`Posting payment for employee ${targetEmpId}...`);
    const payload = {
       amount: 4002, // 4002 DA
       date: new Date().toISOString().split('T')[0],
       description: 'Salaire + Prime (2026-03)'
    };
    const payRes = await fetch(`http://localhost:5000/api/employees/${targetEmpId}/payments`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify(payload)
    });
    
    const payData = await payRes.json();
    if (!payRes.ok) {
        console.error("Backend Error:", payRes.status, payData);
    } else {
        console.log("Payment Success!", payData);
    }

  } catch (err) {
    console.error("Script error:", err);
  }
}

testPayment();
