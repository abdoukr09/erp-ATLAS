const express = require('express');
const router = require('./routes/dashboard');

async function test() {
  const getStatsLayer = router.stack.find(layer => layer.route && layer.route.path === '/stats');
  if (!getStatsLayer) { console.log("Route not found"); return; }

  // Layer indices: 0 is authenticate middleware, 1 is controller handler
  const controller = getStatsLayer.route.stack[1]?.handle || getStatsLayer.route.stack[0]?.handle;

  const req = { user: { id: 1 }, headers: {} };
  const res = {
    json: (data) => console.log("✅ SUCCESS RESPONSE:", Object.keys(data)),
    status: (code) => {
      console.log(`❌ STATUS ${code}`);
      return { json: (err) => console.log("❌ BODY:", err) };
    }
  };

  try {
    await controller(req, res);
  } catch (err) {
    console.error("❌ CRASHED WITH EXCEPTION:", err);
  }
  process.exit();
}

test();
