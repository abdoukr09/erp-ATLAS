const { Sequelize } = require('sequelize');
require('dotenv').config();

// Force the underlying pg driver to accept self-signed certificates globally
const pg = require('pg');
pg.defaults.ssl = {
  rejectUnauthorized: false
};

// Vercel Integrations often inject stale URLs. MY_SUPABASE_URL guarantees a clean override.
const connectionString = process.env.MY_SUPABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;

let sequelize;

if (connectionString) {
  // Parse the URL manually to bypass pg connection-string URI parsing bugs that drop SSL configs
  const { URL } = require('url');
  const pgUrl = new URL(connectionString);
  
  sequelize = new Sequelize(
    pgUrl.pathname.slice(1), // database name
    pgUrl.username,          // username
    pgUrl.password,          // password
    {
      host: pgUrl.hostname,
      port: pgUrl.port,
      dialect: 'postgres',
      logging: false,
      dialectModule: require('pg'),
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      },
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
    }
  );
} else {
  // Local Database Connection (Your Laptop)
  sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD || null,
    {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      dialect: 'postgres',
      logging: false,
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
    }
  );
}

module.exports = sequelize;
