require('dotenv').config();
const { User } = require('./models');
const sequelize = require('./config/database');
const bcrypt = require('bcryptjs');

async function testLogin() {
  try {
    await sequelize.authenticate();
    console.log('Connected to DB');
    
    const user = await User.findOne({ where: { username: 'admin' } });
    if (!user) {
      console.log('User not found');
      return;
    }
    
    console.log('User found:', user.username);
    const isValid = await user.validatePassword('admin123');
    console.log('Password valid for admin123:', isValid);
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit();
  }
}

testLogin();
