/**
 * Push Local Data → Remote Supabase PostgreSQL
 * 
 * Usage: node push_to_supabase.js (run inside server folder)
 * 
 * This script:
 * 1. Connects to your local database and remote Supabase database
 * 2. Reads all tables from local PostgreSQL database
 * 3. Clears and inserts all data into remote Supabase database
 */

require('dotenv').config({ path: __dirname + '/.env' });
const { Sequelize } = require('sequelize');

// ── Remote Supabase Connection ──
const remoteUrl = process.env.POSTGRES_URL;
if (!remoteUrl) {
  console.error('❌ POSTGRES_URL not found in .env');
  process.exit(1);
}

const remoteDb = new Sequelize(remoteUrl, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: { require: true, rejectUnauthorized: false }
  }
});

// ── Local PostgreSQL Connection ──
const localDb = new Sequelize(
  process.env.DB_NAME || 'erp_canape',
  process.env.DB_USER || 'abdoukrimi',
  process.env.DB_PASSWORD || null,
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false,
  }
);

// Tables in dependency order (parents before children)
const TABLES = [
  'users',
  'customers',
  'materials',
  'employees',
  'product_models',
  'worker_types',
  'locations',
  'model_materials',
  'pack_items',
  'worker_type_tariffs',
  'location_stocks',
  'delivery_route_primes',
  'orders',
  'order_items',
  'order_salesmen',
  'productions',
  'production_workers',
  'deliveries',
  'delivery_orders',
  'transfer_delivery_items',
  'payments',
  'expenses',
  'employee_payments',
  'material_reservations',
  'refresh_tokens',
  'audit_logs',
];

async function pushData() {
  console.log('🔗 Connecting to databases...\n');

  try {
    await localDb.authenticate();
    console.log('✅ Connected to Local PostgreSQL');
  } catch (err) {
    console.error('❌ Cannot connect to Local DB:', err.message);
    process.exit(1);
  }

  try {
    await remoteDb.authenticate();
    console.log('✅ Connected to Supabase (remote)');
  } catch (err) {
    console.error('❌ Cannot connect to Supabase:', err.message);
    process.exit(1);
  }

  console.log('\n📦 Starting data push to Supabase...\n');

  // Get list of tables that actually exist on local
  const [localTables] = await localDb.query(`
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
    ORDER BY tablename;
  `);
  const localTableNames = localTables.map(t => t.tablename);

  // Disable FK checks on remote DB during import
  await remoteDb.query('SET session_replication_role = replica;');

  let totalRows = 0;

  for (const table of TABLES) {
    // Check if this table exists on local
    if (!localTableNames.includes(table)) {
      console.log(`   Skip: ${table} — not found locally`);
      continue;
    }

    try {
      // Read all rows from local DB
      const [rows] = await localDb.query(`SELECT * FROM "${table}";`);

      if (rows.length === 0) {
        console.log(`   📭 ${table} — empty locally (0 rows)`);
        continue;
      }

      // Clear remote table first
      await remoteDb.query(`DELETE FROM "${table}";`);

      // Insert in batches of 100
      const batchSize = 100;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const columns = Object.keys(batch[0]);
        const quotedCols = columns.map(c => `"${c}"`).join(', ');

        for (const row of batch) {
          const values = columns.map(col => {
            const val = row[col];
            if (val === null || val === undefined) return 'NULL';
            if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
            if (typeof val === 'number') return val;
            if (val instanceof Date) return `'${val.toISOString()}'`;
            if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
            return `'${String(val).replace(/'/g, "''")}'`;
          });

          await remoteDb.query(`INSERT INTO "${table}" (${quotedCols}) VALUES (${values.join(', ')}) ON CONFLICT DO NOTHING;`);
        }
      }

      // Reset sequences to max id on remote
      try {
        const [maxResult] = await remoteDb.query(`SELECT MAX(id) as max_id FROM "${table}";`);
        if (maxResult[0]?.max_id) {
          await remoteDb.query(`SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), ${maxResult[0].max_id});`);
        }
      } catch (e) {
        // Table might not have an 'id' column or sequence, skip
      }

      totalRows += rows.length;
      console.log(`   ✅ ${table} — ${rows.length} rows pushed`);
    } catch (err) {
      console.error(`   ❌ ${table} — ERROR: ${err.message}`);
    }
  }

  // Re-enable FK checks on remote
  await remoteDb.query('SET session_replication_role = DEFAULT;');

  console.log(`\n🎉 Done! Pushed ${totalRows} total rows to your remote Supabase database.`);
  process.exit(0);
}

pushData().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
