const sequelize = require('./config/database');

async function fix() {
  try {
    console.log("Adding quantity column to productions table...");
    // Check if column exists first (optional but safe with ADD COLUMN IF NOT EXISTS in newer PG)
    // In PG 9.6+, ADD COLUMN IF NOT EXISTS is NOT natively supported for ALTER TABLE ADD COLUMN in some dialects directly without PL/pgSQL
    // Wait, ALTER TABLE table_name ADD COLUMN IF NOT EXISTS column_name IS supported in Postgres 9.6+!
    
    await sequelize.query('ALTER TABLE "productions" ADD COLUMN IF NOT EXISTS "quantity" INTEGER DEFAULT 1');
    console.log("✅ Column 'quantity' added successfully (or already existed).");
  } catch (e) {
    console.error("❌ Failed to add column:", e.message);
  } finally {
    process.exit();
  }
}
fix();
