/**
 * Import MySQL/MariaDB JSON Export from phpMyAdmin → Local PostgreSQL
 * 
 * Usage: node import_mysql_json.js
 * 
 * Instructions:
 * 1. Go to phpMyAdmin, click on your database, click "Export".
 * 2. Select format: "JSON".
 * 3. Save the file in the project root folder as "database_export.json".
 * 4. Run: node server/import_mysql_json.js
 */

require('dotenv').config({ path: __dirname + '/.env' });
const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');

const jsonFilePath = path.join(__dirname, '../database_export.json');
const jsonDirPath = path.join(__dirname, '../database_export');

let importSource = null;
if (fs.existsSync(jsonDirPath) && fs.lstatSync(jsonDirPath).isDirectory()) {
  importSource = { type: 'directory', path: jsonDirPath };
} else if (fs.existsSync(jsonFilePath)) {
  importSource = { type: 'file', path: jsonFilePath };
}

if (!importSource) {
  console.error('❌ Could not find database export.');
  console.log('Please export your database tables from TablePlus or phpMyAdmin as JSON and save them as either:');
  console.log('  1. A file named "database_export.json" in the project root folder');
  console.log('  2. A folder named "database_export" containing table JSON files (e.g. users.json) in the project root folder');
  process.exit(1);
}

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

// Map phpMyAdmin table names (often lowercase or pluralized) to local PG table names
const TABLE_MAPPING = {
  'users': 'Users',
  'customers': 'Customers',
  'materials': 'Materials',
  'employees': 'Employees',
  'product_models': 'ProductModels',
  'productmodels': 'ProductModels',
  'worker_types': 'WorkerTypes',
  'workertypes': 'WorkerTypes',
  'locations': 'Locations',
  'model_materials': 'ModelMaterials',
  'modelmaterials': 'ModelMaterials',
  'pack_items': 'PackItems',
  'packitems': 'PackItems',
  'worker_type_tariffs': 'WorkerTypeTariffs',
  'workertypetariffs': 'WorkerTypeTariffs',
  'location_stocks': 'LocationStocks',
  'locationstocks': 'LocationStocks',
  'delivery_route_primes': 'DeliveryRoutePrimes',
  'deliveryrouteprimes': 'DeliveryRoutePrimes',
  'orders': 'Orders',
  'order_items': 'OrderItems',
  'orderitems': 'OrderItems',
  'order_salesmen': 'OrderSalesmen',
  'ordersalesmen': 'OrderSalesmen',
  'productions': 'Productions',
  'production_workers': 'ProductionWorkers',
  'productionworkers': 'ProductionWorkers',
  'deliveries': 'Deliveries',
  'delivery_orders': 'DeliveryOrders',
  'deliveryorders': 'DeliveryOrders',
  'transfer_delivery_items': 'TransferDeliveryItems',
  'transferdeliveryitems': 'TransferDeliveryItems',
  'payments': 'Payments',
  'expenses': 'Expenses',
  'employee_payments': 'EmployeePayments',
  'employeepayments': 'EmployeePayments',
  'material_reservations': 'MaterialReservations',
  'materialreservations': 'MaterialReservations',
  'refresh_tokens': 'RefreshTokens',
  'refreshtokens': 'RefreshTokens',
  'audit_logs': 'AuditLogs',
  'auditlogs': 'AuditLogs',
};

// Dependency order for safe inserting
const TABLES_ORDER = [
  'Users',
  'Customers',
  'Materials',
  'Employees',
  'ProductModels',
  'WorkerTypes',
  'Locations',
  'ModelMaterials',
  'PackItems',
  'WorkerTypeTariffs',
  'LocationStocks',
  'DeliveryRoutePrimes',
  'Orders',
  'OrderItems',
  'OrderSalesmen',
  'Productions',
  'ProductionWorkers',
  'Deliveries',
  'DeliveryOrders',
  'TransferDeliveryItems',
  'Payments',
  'Expenses',
  'EmployeePayments',
  'MaterialReservations',
  'RefreshTokens',
  'AuditLogs',
];

async function run() {
  let tablesData = {};

  if (importSource.type === 'directory') {
    console.log(`📖 Reading JSON files from directory: ${importSource.path}...`);
    try {
      const files = fs.readdirSync(importSource.path);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const tableName = path.basename(file, '.json');
          const filePath = path.join(importSource.path, file);
          const rawContent = fs.readFileSync(filePath, 'utf8');
          try {
            const parsed = JSON.parse(rawContent);
            if (Array.isArray(parsed)) {
              tablesData[tableName] = parsed;
            } else if (parsed && Array.isArray(parsed.data)) {
              tablesData[tableName] = parsed.data;
            }
          } catch (e) {
            console.warn(`   ⚠️  Failed to parse ${file}: ${e.message}`);
          }
        }
      }
    } catch (err) {
      console.error('❌ Failed to read database_export directory:', err.message);
      process.exit(1);
    }
  } else {
    console.log(`📖 Reading database_export.json...`);
    let data;
    try {
      const rawContent = fs.readFileSync(importSource.path, 'utf8');
      data = JSON.parse(rawContent);
    } catch (err) {
      console.error('❌ Failed to parse JSON file:', err.message);
      process.exit(1);
    }

    if (Array.isArray(data)) {
      for (const item of data) {
        if (item.type === 'table' && item.name && Array.isArray(item.data)) {
          tablesData[item.name] = item.data;
        }
      }
    } else if (typeof data === 'object') {
      if (data.type === 'table' && data.name && Array.isArray(data.data)) {
        tablesData[data.name] = data.data;
      } else {
        for (const key of Object.keys(data)) {
          if (Array.isArray(data[key])) {
            tablesData[key] = data[key];
          } else if (typeof data[key] === 'object' && data[key] !== null) {
            for (const subKey of Object.keys(data[key])) {
              if (Array.isArray(data[key][subKey])) {
                tablesData[subKey] = data[key][subKey];
              }
            }
          }
        }
      }
    }
  }

  const foundTables = Object.keys(tablesData);
  if (foundTables.length === 0) {
    console.error('❌ No tables found to import.');
    console.log('Make sure your JSON files contain actual arrays of records.');
    process.exit(1);
  }

  console.log(`📡 Found ${foundTables.length} tables in JSON: ${foundTables.join(', ')}`);

  try {
    await localDb.authenticate();
    console.log('✅ Connected to Local PostgreSQL');
  } catch (err) {
    console.error('❌ Cannot connect to local PostgreSQL:', err.message);
    process.exit(1);
  }

  // Disable FK checks on local DB during import
  await localDb.query('SET session_replication_role = replica;');

  let totalRows = 0;

  for (const targetTable of TABLES_ORDER) {
    // Find matching key in tablesData
    const sourceKey = foundTables.find(k => {
      const mapped = TABLE_MAPPING[k.toLowerCase()] || k;
      return mapped.toLowerCase() === targetTable.toLowerCase();
    });

    if (!sourceKey) {
      console.log(`   skip: ${targetTable} (not found in JSON export)`);
      continue;
    }

    const rows = tablesData[sourceKey];
    if (!rows || rows.length === 0) {
      console.log(`   📭 ${targetTable} — empty (0 rows)`);
      continue;
    }

    try {
      // Clear local table first
      await localDb.query(`DELETE FROM "${targetTable}";`);

      const columns = Object.keys(rows[0]);
      const quotedCols = columns.map(c => `"${c}"`).join(', ');

      for (const row of rows) {
        const values = columns.map(col => {
          const val = row[col];
          if (val === null || val === undefined) return 'NULL';
          if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
          if (typeof val === 'number') return val;
          if (val instanceof Date) return `'${val.toISOString()}'`;
          if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
          return `'${String(val).replace(/'/g, "''")}'`;
        });

        await localDb.query(`INSERT INTO "${targetTable}" (${quotedCols}) VALUES (${values.join(', ')}) ON CONFLICT DO NOTHING;`);
      }

      // Reset auto-increment sequence
      try {
        const [maxResult] = await localDb.query(`SELECT MAX(id) as max_id FROM "${targetTable}";`);
        if (maxResult[0]?.max_id) {
          await localDb.query(`SELECT setval(pg_get_serial_sequence('"${targetTable}"', 'id'), ${maxResult[0].max_id});`);
        }
      } catch (e) {}

      totalRows += rows.length;
      console.log(`   ✅ ${targetTable} — ${rows.length} rows imported`);
    } catch (err) {
      console.error(`   ❌ ${targetTable} — ERROR: ${err.message}`);
    }
  }

  // Re-enable FK checks
  await localDb.query('SET session_replication_role = DEFAULT;');

  console.log(`\n🎉 Success! Imported ${totalRows} rows into your local PostgreSQL database.`);
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Fatal error during migration:', err);
  process.exit(1);
});
