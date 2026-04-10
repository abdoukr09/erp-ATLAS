require('dotenv').config();
const sequelize = require('./config/database');
const { User } = require('./models');

async function syncAndWipe() {
  try {
    await sequelize.authenticate();
    console.log('🔗 Connected to Supabase Cloud! Wiping all data...');

    // force: true DROPS all tables and recreates them entirely empty
    await sequelize.sync({ force: true });
    
    console.log('✅ Success! All data wiped. Creating default admin...');
    await User.create({
      username: 'admin',
      password: 'password123',
      fullName: 'System Admin',
      role: 'admin',
      email: 'admin@erp-canape.com'
    });

    console.log('✅ Success! Database is completely empty and ready to use (admin / password123).');

  } catch (error) {
    console.error('❌ Sync failed:', error);
  } finally {
    process.exit();
  }
}

syncAndWipe();
