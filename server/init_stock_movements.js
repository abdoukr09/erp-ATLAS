// One-time script: prepares the stock_movements table for offline sync.
// Run ONCE (locally, it targets the Supabase DB):  node server/init_stock_movements.js
//
// Creates the table if missing, then the UNIQUE index on opUuid. That index is
// what makes re-sending a batch harmless — without it, a tablet retrying after a
// dropped connection would apply every movement twice.
require('dotenv').config({ path: __dirname + '/.env' });
const sequelize = require('./config/database');
const { StockMovement } = require('./models');

(async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Connecté à la base.');

    await StockMovement.sync();
    console.log('✅ Table stock_movements prête.');

    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS stock_movements_opuuid_key
      ON stock_movements ("opUuid");
    `);
    console.log('✅ Index unique sur opUuid créé — les lots renvoyés deux fois ne feront jamais de doublon.');

    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur :', err.message);
    process.exit(1);
  }
})();
