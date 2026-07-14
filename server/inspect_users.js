require('dotenv').config();
const { User } = require('./models');
const sequelize = require('./config/database');

async function inspectUsers() {
  try {
    await sequelize.authenticate();
    console.log('Connected to DB');
    
    const users = await User.findAll({ attributes: ['id', 'username', 'role', 'active', 'failedLoginAttempts', 'lockedUntil'] });
    console.log('Users in database:');
    users.forEach(u => {
      console.log(`- Username: ${u.username} | Role: ${u.role} | Active: ${u.active} | FailedLogins: ${u.failedLoginAttempts} | Locked: ${u.lockedUntil}`);
    });
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit();
  }
}

inspectUsers();
