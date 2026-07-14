require('dotenv').config();
const { User } = require('./models');
const sequelize = require('./config/database');
const bcrypt = require('bcryptjs');

async function resetPassword() {
  try {
    await sequelize.authenticate();
    console.log('Connected to DB');
    
    const admin = await User.findOne({ where: { username: 'admin' } });
    if (admin) {
      // The beforeUpdate hook in User.js automatically hashes the password
      admin.password = 'admin123';
      admin.failedLoginAttempts = 0;
      admin.lockedUntil = null;
      await admin.save();
      console.log('✅ Password for "admin" successfully reset to "admin123"!');
    } else {
      console.log('User admin not found.');
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit();
  }
}

resetPassword();
