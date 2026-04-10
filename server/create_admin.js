require('dotenv').config();
const { User } = require('./models');
const sequelize = require('./config/database');

async function createAdmin() {
  try {
    await sequelize.authenticate();
    
    // Check if admin already exists
    const existingAdmin = await User.findOne({ where: { username: 'admin' } });
    if (existingAdmin) {
      console.log('Admin user already exists!');
      process.exit();
    }

    // Create the super admin
    await User.create({
      username: 'admin',
      password: 'password123',
      fullName: 'System Admin',
      role: 'admin',
      email: 'admin@erp-canape.com'
    });

    console.log('✅ Admin user successfully created in the Supabase Cloud!');
    console.log('Username: admin');
    console.log('Password: password123');

  } catch (err) {
    console.error('Error creating admin:', err);
  } finally {
    process.exit();
  }
}

createAdmin();
