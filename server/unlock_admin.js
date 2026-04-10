require('dotenv').config();
const { Sequelize } = require('sequelize');
const { User } = require('./models');

const sequelize = new Sequelize(process.env.POSTGRES_URL, {
  dialect: 'postgres',
  dialectModule: require('pg'),
  logging: false
});

async function unlockAdmin() {
  try {
    await sequelize.authenticate();
    
    const admin = await User.findOne({ where: { username: 'admin' } });
    if (admin) {
      await admin.update({
        failedLoginAttempts: 0,
        lockedUntil: null
      });
      console.log('✅ Admin account successfully unlocked! You can log in right now.');
    } else {
      console.log('Admin account not found.');
    }
  } catch (err) {
    console.error('Error unlocking admin:', err);
  } finally {
    process.exit();
  }
}

unlockAdmin();
