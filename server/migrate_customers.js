const sequelize = require('./config/database');
async function migrate() {
  try {
    const [results, metadata] = await sequelize.query(`SELECT column_name FROM information_schema.columns WHERE table_name='customers' AND column_name='isDeleted';`);
    if (results.length === 0) {
      await sequelize.query('ALTER TABLE customers ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;');
      console.log('Added isDeleted to customers.');
    } else {
      console.log('isDeleted already exists.');
    }
  } catch (error) {
    console.error('Migration error:', error);
  }
  process.exit(0);
}
migrate();
