// One-time script to add the unique index on productions.orderItemId
// Run this ONCE: node server/add_unique_index.js
require('dotenv').config({ path: __dirname + '/.env' });
const sequelize = require('./config/database');

(async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected. Adding unique index...');
    
    // Add the unique partial index (only where orderItemId is NOT null)
    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS unique_order_item_production 
      ON productions ("orderItemId") 
      WHERE "orderItemId" IS NOT NULL;
    `);
    
    console.log('✅ Unique index added! Duplicate productions are now impossible.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
