const sequelize = require('./config/database');
async function fix() {
  try {
    const [results] = await sequelize.query("SELECT typname FROM pg_type WHERE typname LIKE 'enum_%'");
    console.log("Types:", results);
    await sequelize.query("ALTER TYPE enum_users_role ADD VALUE IF NOT EXISTS 'gerant'");
    console.log("Success");
  } catch (e) {
    console.error(e);
  } finally {
    process.exit();
  }
}
fix();
