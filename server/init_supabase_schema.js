/**
 * Initialize Supabase Database Schema
 */
require('dotenv').config({ path: __dirname + '/.env' });

// Force database.js to connect to the remote Supabase URL instead of local DB
process.env.FORCE_REMOTE_DB = 'true';

const sequelize = require('./config/database');
const models = require('./models');

async function run() {
  console.log('🔗 Connecting to Supabase to initialize schema...');
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to Supabase');
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    process.exit(1);
  }

  console.log('📦 Syncing models to create tables...');
  
  // This will create all the tables in the Supabase database
  // We use { force: true } because the database should be empty, and it ensures a fresh schema
  try {
    await sequelize.sync({ force: true });
    console.log('✅ Tables created successfully!');
  } catch (err) {
    console.error('❌ Failed to create tables:', err.message);
    process.exit(1);
  }

  process.exit(0);
}

run();
