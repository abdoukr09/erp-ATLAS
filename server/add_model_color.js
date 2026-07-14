// Migration: add product_models.color, and drop the old UNIQUE-on-(name) constraint
// so two catalog models may share a name with different colors. (name,color) identity
// is enforced case-insensitively in the route.
const sequelize = require('./config/database');

(async () => {
  try {
    await sequelize.authenticate();

    // 1) Add color column (no-op if it already exists)
    await sequelize.query('ALTER TABLE product_models ADD COLUMN IF NOT EXISTS color VARCHAR(50);');
    console.log('color column ensured');

    // 2) Find UNIQUE constraints on product_models and drop those on (name) only
    const [cons] = await sequelize.query(`
      SELECT con.conname AS conname,
             (SELECT string_agg(att.attname, ',' ORDER BY att.attnum)
              FROM unnest(con.conkey) AS k(attnum)
              JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = k.attnum) AS cols
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      WHERE rel.relname = 'product_models' AND con.contype = 'u'`);

    for (const c of cons) {
      if (c.cols === 'name') {
        await sequelize.query(`ALTER TABLE product_models DROP CONSTRAINT "${c.conname}";`);
        console.log('dropped unique constraint ' + c.conname + ' (on ' + c.cols + ')');
      } else {
        console.log('kept unique constraint ' + c.conname + ' (on ' + c.cols + ')');
      }
    }

    // 3) Verify
    const [cols] = await sequelize.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name='product_models' ORDER BY ordinal_position;`);
    console.log('\nColumns:', cols.map(c => c.column_name).join(', '));
    const [after] = await sequelize.query(
      `SELECT indexname, indexdef FROM pg_indexes WHERE tablename='product_models';`);
    console.log('\nRemaining indexes on product_models:');
    console.table(after);

    await sequelize.close();
    console.log('\nMIGRATION OK');
    process.exit(0);
  } catch (e) {
    console.log('MIGRATION FAILED: ' + e.message);
    try { await sequelize.close(); } catch (_) {}
    process.exit(1);
  }
})();
