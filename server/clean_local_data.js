const { Production } = require('./models');
const sequelize = require('./config/database');

async function cleanDuplicates() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to LOCAL database for cleaning.');

    // Find all orderItemIds that have duplicates
    const [duplicates] = await sequelize.query(`
      SELECT "orderItemId", COUNT(*) 
      FROM productions 
      WHERE "orderItemId" IS NOT NULL 
      GROUP BY "orderItemId" 
      HAVING COUNT(*) > 1
    `);

    console.log(`Found ${duplicates.length} orderItems with duplicates.`);

    for (const dup of duplicates) {
      const orderItemId = dup.orderItemId;
      // Keep the newest record, delete the older ones
      const records = await Production.findAll({
        where: { orderItemId },
        order: [['createdAt', 'DESC']]
      });

      // Keep index 0, delete others
      for (let i = 1; i < records.length; i++) {
        await records[i].destroy();
        console.log(`🗑️ Deleted duplicate production #${records[i].id} for orderItem ${orderItemId}`);
      }
    }

    console.log('✅ Done cleaning duplicates.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during cleaning:', err);
    process.exit(1);
  }
}

cleanDuplicates();
