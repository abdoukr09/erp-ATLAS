const sequelize = require('./config/database');
async function fix() {
  try {
    await sequelize.query("ALTER TYPE enum_deliveries_status ADD VALUE IF NOT EXISTS 'cancelled'");
    console.log("Success adding cancelled to deliveries status");
  } catch (e) {
    console.error("Error adding cancelled:", e.message);
  } finally {
    process.exit();
  }
}
fix();
