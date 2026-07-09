/**
 * Pull Production Data from Supabase → Local PostgreSQL
 * 
 * Usage: node pull_from_supabase.js (run inside server folder)
 * 
 * This script:
 * 1. Connects to your remote Supabase database
 * 2. Reads all tables in the correct order (respecting foreign keys)
 * 3. Inserts everything into your local erp_canape database
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

async function pullData() {
  console.log('🔗 Connecting to databases...\n');

  try {
    await remoteDb.authenticate();
    console.log('✅ Connected to Supabase (remote)');
  } catch (err) {
    console.error('❌ Cannot connect to Supabase:', err.message);
    process.exit(1);
  }

  try {
    await localDb.authenticate();
    console.log('✅ Connected to Local PostgreSQL');
  } catch (err) {
    console.error('❌ Cannot connect to Local DB:', err.message);
    process.exit(1);
  }

  console.log('\n📦 Starting data pull...\n');

  // Get list of tables that actually exist on remote
  const [remoteTables] = await remoteDb.query(`
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
    ORDER BY tablename;
  `);
  const remoteTableNames = remoteTables.map(t => t.tablename);
  console.log(`   Found ${remoteTableNames.length} tables on Supabase: ${remoteTableNames.join(', ')}\n`);

  // Disable FK checks on local DB during import
  await localDb.query('SET session_replication_role = replica;');

  let totalRows = 0;

  for (const table of TABLES) {
    // Check if this table exists on remote
    if (!remoteTableNames.includes(table)) {
      console.log(`   Skip: ${table} — not found on remote`);
      continue;
    }

    try {
      // Read all rows from remote
      const [rows] = await remoteDb.query(`SELECT * FROM "${table}";`);

      if (rows.length === 0) {
        console.log(`   📭 ${table} — empty (0 rows)`);
        continue;
      }

      // Clear local table first
      await localDb.query(`DELETE FROM "${table}";`);

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

          await localDb.query(`INSERT INTO "${table}" (${quotedCols}) VALUES (${values.join(', ')}) ON CONFLICT DO NOTHING;`);
        }
      }

      // Reset sequences to max id
      try {
        const [maxResult] = await localDb.query(`SELECT MAX(id) as max_id FROM "${table}";`);
        if (maxResult[0]?.max_id) {
          await localDb.query(`SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), ${maxResult[0].max_id});`);
        }
      } catch (e) {
        // Table might not have an 'id' column or sequence, skip
      }

      totalRows += rows.length;
      console.log(`   ✅ ${table} — ${rows.length} rows imported`);
    } catch (err) {
      console.error(`   ❌ ${table} — ERROR: ${err.message}`);
    }
  }

  // Re-enable FK checks
  await localDb.query('SET session_replication_role = DEFAULT;');

  console.log(`\n🎉 Done! Imported ${totalRows} total rows into your local database.`);
  console.log('   You can now run your server locally.');

  process.exit(0);
}

pullData().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
