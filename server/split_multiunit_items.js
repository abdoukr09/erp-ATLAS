// Migration: split each existing multi-unit OrderItem (quantity > 1) into
// N separate OrderItems of quantity 1, so every physical unit has its own
// product id (and can then get its own production id). All units keep sharing
// the same order (commande) id. The original row keeps its quantity=1 and any
// production already attached to it; the extra units are created as fresh
// 'pending' clones. Only safe statuses (pending / in_production) are split;
// terminal states (ready/delivered/cancelled/problem) are reported and skipped.
const sequelize = require('./config/database');
const { OrderItem, Production } = require('./models');
const { Op } = require('sequelize');

(async () => {
  const t = await sequelize.transaction();
  try {
    const multi = await OrderItem.findAll({
      where: { quantity: { [Op.gt]: 1 } },
      order: [['id', 'ASC']],
      transaction: t,
    });

    console.log('=== BEFORE: order items with quantity > 1 ===');
    for (const it of multi) {
      const prodCount = await Production.count({ where: { orderItemId: it.id }, transaction: t });
      console.log(`  item #${it.id} | order #${it.orderId} | ${it.sofaModel} | qty=${it.quantity} | status=${it.status} | productions=${prodCount}`);
    }
    if (multi.length === 0) console.log('  (none — nothing to split)');
    console.log('');

    const SPLITTABLE = ['pending', 'in_production'];
    const affectedOrders = new Set();
    let createdCount = 0;
    const skipped = [];

    for (const it of multi) {
      if (!SPLITTABLE.includes(it.status)) {
        skipped.push(`item #${it.id} (status=${it.status}) — left untouched`);
        continue;
      }
      const originalQty = it.quantity;
      const clonesToCreate = originalQty - 1;

      for (let i = 0; i < clonesToCreate; i++) {
        await OrderItem.create({
          orderId: it.orderId,
          sofaModel: it.sofaModel,
          quantity: 1,
          unitPrice: it.unitPrice,
          discountPercentage: it.discountPercentage || 0,
          fabric: it.fabric || '',
          color: it.color || '',
          status: 'pending',
        }, { transaction: t });
        createdCount++;
      }

      await it.update({ quantity: 1 }, { transaction: t });
      affectedOrders.add(it.orderId);
      console.log(`  split item #${it.id} (${it.sofaModel}) qty ${originalQty} -> 1 original + ${clonesToCreate} new units`);
    }

    console.log('');
    console.log(`Rows created: ${createdCount}`);
    if (skipped.length) { console.log('Skipped:'); skipped.forEach(s => console.log('  - ' + s)); }
    console.log('');

    // AFTER: show the full per-unit breakdown for every affected order
    console.log('=== AFTER: per-unit items for affected orders ===');
    for (const orderId of [...affectedOrders].sort((a, b) => a - b)) {
      const items = await OrderItem.findAll({ where: { orderId }, order: [['id', 'ASC']], transaction: t });
      console.log(`  Order (commande) #${orderId} -> ${items.length} product(s):`);
      for (const it of items) {
        const prodCount = await Production.count({ where: { orderItemId: it.id }, transaction: t });
        console.log(`     product #${it.id} | ${it.sofaModel} | qty=${it.quantity} | status=${it.status} | productions=${prodCount}`);
      }
    }

    await t.commit();
    console.log('\nMIGRATION COMMITTED OK');
    await sequelize.close();
    process.exit(0);
  } catch (e) {
    await t.rollback();
    console.log('MIGRATION FAILED (rolled back): ' + e.message);
    try { await sequelize.close(); } catch (_) {}
    process.exit(1);
  }
})();
