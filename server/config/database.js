const { Sequelize } = require('sequelize');
require('dotenv').config();

// Force the underlying pg driver to accept self-signed certificates globally
const pg = require('pg');
pg.defaults.ssl = {
  rejectUnauthorized: false
};
// Disable prepared statements globally — Supabase Transaction Mode (pgbouncer) can't handle them.
// Without this, connections crash after rotation because pgbouncer doesn't track prepared statement state.
pg.defaults.prepareThreshold = 0;

// Vercel Integrations often inject stale URLs. MY_SUPABASE_URL guarantees a clean override.
const connectionString = process.env.MY_SUPABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;

let finalUrl = connectionString;

// SERVERLESS LIFESAVER: If Vercel is sending us to port 5432 (Session Mode), force it to 6543 (Transaction Mode)
// Serverless functions create too many micro-connections for Session mode to handle.
if (finalUrl && finalUrl.includes(':5432')) {
  finalUrl = finalUrl.replace(':5432', ':6543');
}

let sequelize;

if (process.env.NODE_ENV === 'production') {
  // Production Database Connection (Vercel -> Supabase Pooler)
  sequelize = new Sequelize(finalUrl, {
    dialect: 'postgres',
    dialectModule: pg,
    logging: false,
    pool: {
      max: 5, // pgbouncer on port 6543 handles connection sharing, so 5 is safe even on serverless
      min: 0,
      acquire: 30000,
      idle: 5000,
    },
    // We already intercepted the global pg driver for SSL, but adding it explicitly here as backup.
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      },
      // MANDATORY for Supabase Transaction Mode (pgbouncer on port 6543).
      // pgbouncer rotates connections between queries, so prepared statements break.
      statement_timeout: 30000,
      idle_in_transaction_session_timeout: 10000,
    },
    // Disable prepared statements globally — pgbouncer can't handle them
    define: { timestamps: true },
    query: { raw: false }
  });
} else if (connectionString) {
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
