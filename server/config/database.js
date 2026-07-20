const { Sequelize } = require('sequelize');
require('dotenv').config();

const pg = require('pg');
// No global defaults here to prevent interfering with local connections.
// SSL and prepared statement settings will be applied per-instance below.


// Vercel Integrations often inject stale URLs. MY_SUPABASE_URL guarantees a clean override.
const connectionString = process.env.MY_SUPABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;

let finalUrl = connectionString;

// SERVERLESS LIFESAVER: If Vercel is sending us to port 5432 (Session Mode), force it to 6543 (Transaction Mode)
// Serverless functions create too many micro-connections for Session mode to handle.
if (finalUrl && finalUrl.includes(':5432')) {
  finalUrl = finalUrl.replace(':5432', ':6543');
}

let sequelize;

// ─── Stale connection resilience ────────────────────────────────────────────
// Supabase drops connections that sat idle, but Sequelize's pool leaves
// eviction OFF by default (generic-pool evictionRunIntervalMillis = 0). A dev
// server left running overnight therefore hands out a dead socket on the next
// query, which hangs ~11s and surfaces as "Internal server error" on login.
// `evict` reaps them in the background; `retry` re-runs a query that still
// lands on a broken one; `keepAlive` stops the OS dropping the socket first.
const POOL = {
  max: 5,
  min: 0,
  acquire: 30000,
  idle: 10000,
  evict: 10000,
};

const RETRY_ON_DEAD_CONNECTION = {
  match: [
    /ECONNRESET/,
    /ETIMEDOUT/,
    /EPIPE/,
    /Connection terminated/i,
    /server closed the connection/i,
    /SequelizeConnectionError/,
  ],
  max: 3,
};

if (process.env.NODE_ENV === 'production') {
  // Production Database Connection (Vercel -> Supabase Pooler)
  sequelize = new Sequelize(finalUrl, {
    dialect: 'postgres',
    dialectModule: pg,
    logging: false,
    // pgbouncer on port 6543 handles connection sharing, so 5 is safe even on serverless
    pool: { ...POOL, idle: 5000 },
    retry: RETRY_ON_DEAD_CONNECTION,
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
      keepAlive: true,
    },
    // Disable prepared statements globally — pgbouncer can't handle them
    define: { timestamps: true },
    query: { raw: false }
  });
} else if (process.env.DB_NAME && !process.env.FORCE_REMOTE_DB) {
  // Local Database Connection (Your Laptop)
  sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD || null,
    {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      dialect: 'postgres',
      logging: false,
      pool: POOL,
      retry: RETRY_ON_DEAD_CONNECTION,
    }
  );
  console.log('📡 Using LOCAL database configuration');
} else if (connectionString) {
  // Remote/Supabase Database Connection (Used locally for testing remote data)
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
        },
        keepAlive: true,
      },
      pool: POOL,
      retry: RETRY_ON_DEAD_CONNECTION,
    }
  );
  console.log('📡 Using REMOTE (Supabase) database configuration locally');
}


module.exports = sequelize;
