require('dotenv').config({ path: __dirname + '/../.env' });
const sequelize = require('../config/database');
const { User } = require('../models');

async function seed() {
  try {
    await sequelize.sync({ force: false });

    // Create default admin user
    const existing = await User.findOne({ where: { username: 'admin' } });
    if (!existing) {
      await User.create({
        username: 'admin',
        password: 'admin123',
        fullName: 'Administrator',
        role: 'admin',
        email: 'admin@lecanape.com',
      });
      console.log('✅ Default admin user created (admin / admin123)');
    } else {
      console.log('ℹ️  Admin user already exists');
    }

    console.log('✅ Seed complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

seed();
