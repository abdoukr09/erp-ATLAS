const express = require('express');
const { Delivery, Order, Payment, OrderItem, Location, TransferDeliveryItem, ProductModel, Employee, DeliveryOrder, Customer } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

// GET /api/deliveries
router.get('/', authenticate, authorize('admin', 'delivery', 'gerant'), async (req, res) => {
  try {
    const deliveries = await Delivery.findAll({
      include: [
        { 
          model: Order, 
          as: 'order', 
          attributes: ['id', 'status', 'totalPrice', 'advancePayment', 'remainingPayment', 'paymentStatus', 'deliveryAddress', 'sofaModel', 'quantity'],
          include: [
            { model: Customer, as: 'customer', attributes: ['name', 'phone', 'address', 'city'] },
            { model: OrderItem, as: 'items', attributes: ['id', 'sofaModel', 'quantity', 'status', 'unitPrice', 'discountPercentage'] }
          ]
        },
        { model: Location, as: 'sourceLocation', attributes: ['id', 'name', 'color'] },
        { model: Location, as: 'destLocation', attributes: ['id', 'name', 'color'] },
        { 
          model: TransferDeliveryItem, 
          as: 'transferItems', 
          include: [{ model: ProductModel, as: 'productModel', attributes: ['id', 'name'] }] 
        },
        { model: Employee, as: 'driverEmployee', attributes: ['id', 'name', 'category'] },
        {
          model: DeliveryOrder,
          as: 'deliveryOrders',
          include: [{
            model: Order,
            as: 'order',
            attributes: ['id', 'status', 'totalPrice', 'advancePayment', 'remainingPayment', 'paymentStatus', 'deliveryAddress', 'sofaModel', 'quantity'],
            include: [
              { model: Customer, as: 'customer', attributes: ['name', 'phone', 'address', 'city'] },
              { model: OrderItem, as: 'items', attributes: ['id', 'sofaModel', 'quantity', 'status', 'unitPrice', 'discountPercentage'] }
            ]
          }]
        }
      ],
      order: [['createdAt', 'DESC']],
    });
    res.json(deliveries);
  } catch (error) {
    console.error('Get Deliveries Error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/deliveries
router.post('/', authenticate, authorize('admin', 'delivery', 'gerant'), async (req, res) => {
  const t = await Delivery.sequelize.transaction();
  try {
    const { orderId, orderIds, driver, driverId, deliveryDate, address, notes, type, sourceLocationId, destLocationId, destWilaya, transferItems } = req.body;
    
    // Resolve driver name from employee if driverId provided
    let driverName = driver;
    if (driverId && !driver) {
      const emp = await Employee.findByPk(driverId, { transaction: t });
      if (emp) driverName = emp.name;
    }
    
    if (type === 'transfer') {
      const delivery = await Delivery.create({
        type: 'transfer',
        driver: driverName,
        driverId: driverId || null,
        deliveryDate,
        address: address || 'Transfert Interne',
        notes,
        sourceLocationId: sourceLocationId || null, // null = Usine
        destLocationId: destLocationId || null,
        destWilaya: null,
      }, { transaction: t });

      if (transferItems && transferItems.length > 0) {
        await TransferDeliveryItem.bulkCreate(
          transferItems.map(item => ({
            deliveryId: delivery.id,
            productModelId: item.productModelId,
            quantity: item.quantity
          })),
          { transaction: t }
        );
      }

      await t.commit();
      
      const fullTransfer = await Delivery.findByPk(delivery.id, {
        include: [
          { model: Location, as: 'sourceLocation', attributes: ['id', 'name', 'color'] },
          { model: Location, as: 'destLocation', attributes: ['id', 'name', 'color'] },
          { model: Employee, as: 'driverEmployee', attributes: ['id', 'name', 'category'] },
          { 
            model: TransferDeliveryItem, 
            as: 'transferItems', 
            include: [{ model: ProductModel, as: 'productModel', attributes: ['id', 'name'] }] 
          },
        ]
      });
      return res.status(201).json(fullTransfer);
    }

    // CLIENT DELIVERY
    // Support multiple orders via orderIds array, fallback to single orderId
    const targetOrderIds = orderIds && orderIds.length > 0 ? orderIds : (orderId ? [orderId] : []);
    
    if (targetOrderIds.length === 0) {
      await t.rollback();
      return res.status(400).json({ error: 'Au moins une commande est requise.' });
    }

    // Verify all orders exist
    const orders = await Order.findAll({ where: { id: targetOrderIds }, transaction: t });
    if (orders.length !== targetOrderIds.length) {
      await t.rollback();
      return res.status(404).json({ error: 'Une ou plusieurs commandes non trouvées.' });
    }

    // Use the first order for backward compatibility (orderId field)
    const primaryOrderId = targetOrderIds[0];
    const primaryOrder = orders.find(o => o.id == primaryOrderId);

    const delivery = await Delivery.create({
      orderId: primaryOrderId,
      driver: driverName,
      driverId: driverId || null,
      deliveryDate,
      address: address || primaryOrder.deliveryAddress,
      notes,
      type: 'order',
      sourceLocationId: sourceLocationId || null,
      destWilaya: destWilaya || null,
    }, { transaction: t });

    // Create DeliveryOrder entries for ALL orders
    await DeliveryOrder.bulkCreate(
      targetOrderIds.map(oId => ({
        deliveryId: delivery.id,
        orderId: oId,
      })),
      { transaction: t }
    );

    await t.commit();

    // Re-fetch with all includes to ensure frontend sees all multi-orders immediately
    const fullDelivery = await Delivery.findByPk(delivery.id, {
      include: [
        { model: Location, as: 'sourceLocation', attributes: ['id', 'name', 'color'] },
        { model: Location, as: 'destLocation', attributes: ['id', 'name', 'color'] },
        { model: Employee, as: 'driverEmployee', attributes: ['id', 'name', 'category'] },
        {
          model: DeliveryOrder,
          as: 'deliveryOrders',
          include: [{
            model: Order,
            as: 'order',
            attributes: ['id', 'status', 'totalPrice', 'advancePayment', 'remainingPayment', 'paymentStatus', 'deliveryAddress', 'sofaModel', 'quantity'],
            include: [
              { model: Customer, as: 'customer', attributes: ['name', 'phone', 'address', 'city'] },
              { model: OrderItem, as: 'items', attributes: ['id', 'sofaModel', 'quantity', 'status', 'unitPrice', 'discountPercentage'] }
            ]
          }]
        }
      ]
    });
    res.status(201).json(fullDelivery);
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error(error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// POST /api/deliveries/quick-transfer
router.post('/quick-transfer', authenticate, authorize('admin', 'delivery', 'gerant'), async (req, res) => {
  const t = await Delivery.sequelize.transaction();
  try {
    const { productModelId, quantity, sourceLocationId, destLocationId } = req.body;
    const qty = parseInt(quantity);
    if (!productModelId || !qty || qty <= 0) {
      await t.rollback();
      return res.status(400).json({ error: 'Paramètres invalides.' });
    }

    // Prevent transferring to the same location
    const srcId = sourceLocationId || null;
    const dstId = destLocationId || null;
    if (srcId === dstId) {
      await t.rollback();
      return res.status(400).json({ error: 'La source et la destination sont identiques.' });
    }

    const { LocationStock } = require('../models');

    // 1. Check Source
    if (sourceLocationId) {
      const srcStock = await LocationStock.findOne({
        where: { locationId: sourceLocationId, productModelId },
        transaction: t,
        lock: t.LOCK.UPDATE
      });
      if (!srcStock || srcStock.quantity < qty) {
        await t.rollback();
        return res.status(400).json({ error: 'Stock insuffisant à la source.' });
      }
    } else {
      // Source is Usine
      const pm = await ProductModel.findByPk(productModelId, { transaction: t, lock: t.LOCK.UPDATE });
      const locStocks = await LocationStock.findAll({ where: { productModelId }, transaction: t });
      const sumLoc = locStocks.reduce((sum, ls) => sum + ls.quantity, 0);
      const usineQty = pm.stock - sumLoc;
      
      if (usineQty < qty) {
        await t.rollback();
        return res.status(400).json({ error: 'Stock insuffisant à l\'usine.' });
      }
    }

    // 2. Create Delivery & Transfer Items
    const delivery = await Delivery.create({
      type: 'transfer',
      driver: 'Déplacement Rapide',
      deliveryDate: new Date(),
      status: 'delivered', // IT IS INSTANTLY DELIVERED
      address: 'Transfert Interne Rapide',
      notes: 'Transfert direct depuis l\'interface "Par Emplacement"',
      sourceLocationId: sourceLocationId || null,
      destLocationId: destLocationId || null,
    }, { transaction: t });

    await TransferDeliveryItem.create({
      deliveryId: delivery.id,
      productModelId,
      quantity: qty
    }, { transaction: t });

    // 3. Move Stock
    if (sourceLocationId) {
      const srcStock = await LocationStock.findOne({
        where: { locationId: sourceLocationId, productModelId },
        transaction: t,
        lock: t.LOCK.UPDATE
      });
      await srcStock.update({ quantity: srcStock.quantity - qty }, { transaction: t });
    }
    
    if (destLocationId) {
      const [dstStock, created] = await LocationStock.findOrCreate({
        where: { locationId: destLocationId, productModelId },
        defaults: { quantity: 0 },
        transaction: t,
        lock: t.LOCK.UPDATE
      });
      await dstStock.update({ quantity: dstStock.quantity + qty }, { transaction: t });
    }

    await t.commit();
    res.json({ message: 'Stock transféré avec succès.' });
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    console.error(err);
    res.status(500).json({ error: 'Erreur Serveur.' });
  }
});

// PUT /api/deliveries/:id
router.put('/:id', authenticate, authorize('admin', 'delivery', 'gerant'), async (req, res) => {
  const t = await Delivery.sequelize.transaction();
  try {
    if (req.body.orderId === '') req.body.orderId = null;
    const delivery = await Delivery.findByPk(req.params.id, {
      include: [{ model: Order, as: 'order' }],
      transaction: t
    });
    if (!delivery) {
      await t.rollback();
      return res.status(404).json({ error: 'Delivery not found.' });
    }

    // Resolve driver name if driverId changed
    if (req.body.driverId && !req.body.driver) {
      const emp = await Employee.findByPk(req.body.driverId, { transaction: t });
      if (emp) req.body.driver = emp.name;
    }

    // Update DeliveryOrder multi-select if orderIds array is provided!
    if (req.body.orderIds && Array.isArray(req.body.orderIds) && delivery.type === 'order') {
      const targetOrderIds = req.body.orderIds.filter(Boolean);
      if (targetOrderIds.length > 0) {
        // We sync: delete old associations and bulkCreate new ones!
        await DeliveryOrder.destroy({ where: { deliveryId: delivery.id }, transaction: t });
        await DeliveryOrder.bulkCreate(
          targetOrderIds.map(oId => ({
            deliveryId: delivery.id,
            orderId: oId,
          })),
          { transaction: t }
        );
        // Also ensure primary orderId is set to the first one
        req.body.orderId = targetOrderIds[0];
      }
    }

    const newStatus = req.body.status;
    const wasDelivered = delivery.status === 'delivered';
    const willBeDelivered = newStatus === 'delivered';
    const wasCancelled = delivery.status === 'cancelled';
    const willBeCancelled = newStatus === 'cancelled';

    // MULTI-ORDER LOGIC: Support all orders in this delivery
    const { DeliveryOrder, Payment, OrderItem, ProductModel, LocationStock } = require('../models');
    const deliveryLinks = await DeliveryOrder.findAll({ where: { deliveryId: delivery.id }, include: [{ model: Order, as: 'order' }], transaction: t });
    const orders = deliveryLinks.map(link => link.order).filter(Boolean);
    
    // Add the primary order if not already in the list
    if (delivery.order && !orders.find(o => o.id === delivery.orderId)) {
      orders.push(delivery.order);
    }

    if (delivery.type === 'order' && orders.length > 0) {
      for (const order of orders) {
        // Changing FROM delivered → something else: reverse the final payment and replenish stock
        if (wasDelivered && !willBeDelivered) {
          await Payment.destroy({
            where: { orderId: order.id, type: 'final' },
            transaction: t,
          });

          // Replenish stock for ALL items
          const orderItems = await OrderItem.findAll({ where: { orderId: order.id }, transaction: t });
          for (const item of orderItems) {
            let pmId = item.productModelId;
            if (!pmId) {
              const pmByName = await ProductModel.findOne({ where: { name: item.sofaModel }, transaction: t });
              if (pmByName) pmId = pmByName.id;
            }
            if (pmId) {
              const pm = await ProductModel.findByPk(pmId, { transaction: t, lock: t.LOCK.UPDATE });
              if (pm) {
                if (delivery.sourceLocationId) {
                  const locStock = await LocationStock.findOne({
                    where: { locationId: delivery.sourceLocationId, productModelId: pm.id },
                    transaction: t, lock: t.LOCK.UPDATE
                  });
                  if (locStock) await locStock.update({ quantity: locStock.quantity + (item.quantity || 1) }, { transaction: t });
                }
                await pm.update({ stock: pm.stock + (item.quantity || 1) }, { transaction: t });
              }
            }
            await item.update({ status: 'ready' }, { transaction: t });
          }

          const hadAdvance = Number(order.advancePayment) > 0;
          await order.update({
            status: 'ready',
            remainingPayment: 0,
            paymentStatus: hadAdvance ? 'advance_paid' : 'unpaid',
          }, { transaction: t });
        }

        // Changing TO delivered (and wasn't before): create final payment and DECREASE stock
        if (!wasDelivered && willBeDelivered) {
          const totalPaid = await Payment.sum('amount', { 
            where: { orderId: order.id, status: 'completed' },
            transaction: t 
          });
          const remainingAmount = Math.max(0, Number(order.totalPrice) - (totalPaid || 0));

          await Payment.destroy({ where: { orderId: order.id, type: 'final' }, transaction: t });
          if (remainingAmount > 0) {
            await Payment.create({
              orderId: order.id,
              amount: remainingAmount,
              method: req.body.paymentMethod || 'cash',
              status: 'completed',
              type: 'final',
              paymentDate: new Date(),
              notes: 'Paiement final à la livraison (via modification manuelle)',
            }, { transaction: t });
          }

          const orderItems = await OrderItem.findAll({ where: { orderId: order.id }, transaction: t });
          for (const item of orderItems) {
            let pmId = item.productModelId;
            if (!pmId) {
              const pmByName = await ProductModel.findOne({ where: { name: item.sofaModel }, transaction: t });
              if (pmByName) pmId = pmByName.id;
            }
            if (pmId) {
              const pm = await ProductModel.findByPk(pmId, { transaction: t, lock: t.LOCK.UPDATE });
              if (pm) {
                if (delivery.sourceLocationId) {
                  const locStock = await LocationStock.findOne({
                    where: { locationId: delivery.sourceLocationId, productModelId: pm.id },
                    transaction: t, lock: t.LOCK.UPDATE
                  });
                  if (locStock) await locStock.update({ quantity: Math.max(0, locStock.quantity - (item.quantity || 1)) }, { transaction: t });
                }
                await pm.update({ stock: Math.max(0, pm.stock - (item.quantity || 1)) }, { transaction: t });
              }
            }
            await item.update({ status: 'delivered' }, { transaction: t });
          }

          await order.update({ status: 'delivered', remainingPayment: 0, paymentStatus: 'fully_paid' }, { transaction: t });
        }

        // Changing TO cancelled
        if (!wasCancelled && willBeCancelled) {
          const orderItems = await OrderItem.findAll({ where: { orderId: order.id }, transaction: t });
          for (const item of orderItems) {
            let pmId = item.productModelId;
            if (!pmId) {
              const pmByName = await ProductModel.findOne({ where: { name: item.sofaModel }, transaction: t });
              if (pmByName) pmId = pmByName.id;
            }
            if (pmId) {
              const model = await ProductModel.findByPk(pmId, { transaction: t, lock: t.LOCK.UPDATE });
              if (model) await model.update({ stock: model.stock + (item.quantity || 1) }, { transaction: t });
            }
            await item.update({ status: 'cancelled' }, { transaction: t });
          }
          await order.update({ status: 'cancelled' }, { transaction: t });
        }

        // Changing FROM cancelled
        if (wasCancelled && !willBeCancelled) {
          const orderItems = await OrderItem.findAll({ where: { orderId: order.id }, transaction: t });
          for (const item of orderItems) {
            let pmId = item.productModelId;
            if (!pmId) {
              const pmByName = await ProductModel.findOne({ where: { name: item.sofaModel }, transaction: t });
              if (pmByName) pmId = pmByName.id;
            }
            if (pmId) {
              const model = await ProductModel.findByPk(pmId, { transaction: t, lock: t.LOCK.UPDATE });
              if (model) {
                if (model.stock < (item.quantity || 1)) {
                  await t.rollback();
                  return res.status(400).json({ error: `Stock insuffisant pour rétablir l'article ${item.sofaModel}.` });
                }
                await model.update({ stock: model.stock - (item.quantity || 1) }, { transaction: t });
              }
            }
            await item.update({ status: 'ready' }, { transaction: t });
          }
          await order.update({ status: 'ready' }, { transaction: t });
        }
      }
    } else if (delivery.type === 'transfer') {
      // INTERNAL TRANSFER LOGIC
      if (!wasDelivered && willBeDelivered) {
        const items = await TransferDeliveryItem.findAll({ where: { deliveryId: delivery.id }, transaction: t });
        const { LocationStock, ProductModel } = require('../models');

        for (const item of items) {
          // 1. Decrement Source (if != Usine)
          if (delivery.sourceLocationId) {
            const srcStock = await LocationStock.findOne({
              where: { locationId: delivery.sourceLocationId, productModelId: item.productModelId },
              transaction: t,
              lock: t.LOCK.UPDATE
            });
            if (srcStock) {
              await srcStock.update({ quantity: Math.max(0, srcStock.quantity - item.quantity) }, { transaction: t });
            }
          }

          // 2. Increment Destination (if != Usine)
          if (delivery.destLocationId) {
            const [dstStock, created] = await LocationStock.findOrCreate({
              where: { locationId: delivery.destLocationId, productModelId: item.productModelId },
              defaults: { quantity: 0 },
              transaction: t,
              lock: t.LOCK.UPDATE
            });
            await dstStock.update({ quantity: dstStock.quantity + item.quantity }, { transaction: t });
          }
          
          // Global ProductModel.stock DOES NOT CHANGE because it's internal!
        }
      }
      
      if (wasDelivered && !willBeDelivered) {
        // Reverse transfer
        const items = await TransferDeliveryItem.findAll({ where: { deliveryId: delivery.id }, transaction: t });
        const { LocationStock } = require('../models');

        for (const item of items) {
          if (delivery.destLocationId) {
            const dstStock = await LocationStock.findOne({
              where: { locationId: delivery.destLocationId, productModelId: item.productModelId },
              transaction: t,
              lock: t.LOCK.UPDATE
            });
            if (dstStock) {
              await dstStock.update({ quantity: Math.max(0, dstStock.quantity - item.quantity) }, { transaction: t });
            }
          }
          if (delivery.sourceLocationId) {
             const [srcStock, created] = await LocationStock.findOrCreate({
               where: { locationId: delivery.sourceLocationId, productModelId: item.productModelId },
               defaults: { quantity: 0 },
               transaction: t,
               lock: t.LOCK.UPDATE
             });
             await srcStock.update({ quantity: srcStock.quantity + item.quantity }, { transaction: t });
          }
        }
      }
    }

    await delivery.update(req.body, { transaction: t });
    await t.commit();

    // Re-fetch everything with all multi-order includes
    const updatedFull = await Delivery.findByPk(delivery.id, {
      include: [
        { model: Location, as: 'sourceLocation', attributes: ['id', 'name', 'color'] },
        { model: Location, as: 'destLocation', attributes: ['id', 'name', 'color'] },
        { model: Employee, as: 'driverEmployee', attributes: ['id', 'name', 'category'] },
        { 
          model: TransferDeliveryItem, 
          as: 'transferItems', 
          include: [{ model: ProductModel, as: 'productModel', attributes: ['id', 'name'] }] 
        },
        {
          model: DeliveryOrder,
          as: 'deliveryOrders',
          include: [{
            model: Order,
            as: 'order',
            attributes: ['id', 'status', 'totalPrice', 'advancePayment', 'remainingPayment', 'paymentStatus', 'deliveryAddress', 'sofaModel', 'quantity'],
            include: [
              { model: Customer, as: 'customer', attributes: ['name', 'phone', 'address', 'city'] },
              { model: OrderItem, as: 'items', attributes: ['id', 'sofaModel', 'quantity', 'status', 'unitPrice', 'discountPercentage'] }
            ]
          }]
        }
      ]
    });
    res.json(updatedFull);
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error('Update Delivery Error:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// POST /api/deliveries/:id/confirm - Confirm delivery per order
router.post('/:id/confirm', authenticate, authorize('admin', 'delivery', 'gerant'), async (req, res) => {
  const t = await Delivery.sequelize.transaction();
  try {
    const delivery = await Delivery.findByPk(req.params.id, {
      include: [{ model: Order, as: 'order' }],
      transaction: t,
    });
    
    if (!delivery) {
      await t.rollback();
      return res.status(404).json({ error: 'Livraison introuvable.' });
    }
    if (delivery.status === 'delivered') {
      await t.rollback();
      return res.status(400).json({ error: 'Cette livraison est déjà confirmée.' });
    }

    // New API expects resolutions array: [{ orderId: 1, status: 'delivered', paymentMethod: 'cash' }, ...]
    const resolutions = req.body.resolutions || [];
    
    // For backwards compatibility before frontend is updated
    if (resolutions.length === 0 && req.body.paymentMethod && delivery.order) {
      resolutions.push({ 
        orderId: delivery.order.id, 
        status: 'delivered', 
        paymentMethod: req.body.paymentMethod 
      });
    }

    if (resolutions.length === 0) {
      await t.rollback();
      return res.status(400).json({ error: 'Aucune résolution de commande fournie.' });
    }

    const { LocationStock, ProductModel, OrderItem, Payment, DeliveryOrder } = require('../models');

    let allSuccessful = true;
    let anyProblems = false;

    // Process each resolution independently
    for (const resItem of resolutions) {
      const order = await Order.findByPk(resItem.orderId, { transaction: t });
      if (!order) continue;

      const orderItems = await OrderItem.findAll({ where: { orderId: order.id }, transaction: t });
      const itemResolutions = resItem.itemStatuses || {}; // Map of itemId_unitIdx -> status

      let orderDeliveredCount = 0;
      let orderProblemCount = 0;
      let orderCancelledCount = 0;

      for (const item of orderItems) {
        // Skip items that are already resolved in previous trips
        if (item.status === 'delivered') {
          orderDeliveredCount += (item.quantity || 1);
          continue;
        }
        if (item.status === 'cancelled') {
          orderCancelledCount += (item.quantity || 1);
          continue;
        }

        // Find all unit resolutions for this specific OrderItem
        const unitStatuses = Object.keys(itemResolutions)
          .filter(key => key.startsWith(`${item.id}_`))
          .map(key => itemResolutions[key]);

        // Fallback to resItem.status if no individual unit statuses were provided
        const finalStatuses = unitStatuses.length > 0 ? unitStatuses : Array(item.quantity || 1).fill(resItem.status);
        
        const deliveredQty = finalStatuses.filter(s => s === 'delivered').length;
        const problemQty = finalStatuses.filter(s => s === 'problem').length;
        const cancelledQty = finalStatuses.filter(s => s === 'cancelled').length;

        orderDeliveredCount += deliveredQty;
        orderProblemCount += problemQty;
        orderCancelledCount += cancelledQty;

        // DEDUCT STOCK ONLY FOR DELIVERED QUANTITY
        if (deliveredQty > 0) {
          let pmId = item.productModelId;
          if (!pmId) {
            const pmByName = await ProductModel.findOne({ where: { name: item.sofaModel }, transaction: t });
            if (pmByName) pmId = pmByName.id;
          }

          if (pmId) {
            const pm = await ProductModel.findByPk(pmId, { transaction: t, lock: t.LOCK.UPDATE });
            if (pm) {
              if (delivery.sourceLocationId) {
                const locStock = await LocationStock.findOne({
                  where: { locationId: delivery.sourceLocationId, productModelId: pm.id },
                  transaction: t, lock: t.LOCK.UPDATE
                });
                if (locStock) {
                  await locStock.update({ quantity: Math.max(0, locStock.quantity - deliveredQty) }, { transaction: t });
                }
              }
              await pm.update({ stock: Math.max(0, pm.stock - deliveredQty) }, { transaction: t });
            }
          }
        }

        // SPLITTING AND STATUS UPDATE
        const statusesToCreate = [];
        if (deliveredQty > 0) statusesToCreate.push({ status: 'delivered', qty: deliveredQty });
        if (problemQty > 0) statusesToCreate.push({ status: 'problem', qty: problemQty });
        if (cancelledQty > 0) statusesToCreate.push({ status: 'cancelled', qty: cancelledQty });
        
        // Handle un-resolved units (e.g. if the user only resolved 1 out of 2 units, the other stays ready)
        const totalResolved = deliveredQty + problemQty + cancelledQty;
        const unresolvedQty = (item.quantity || 1) - totalResolved;
        if (unresolvedQty > 0) statusesToCreate.push({ status: 'ready', qty: unresolvedQty });

        if (statusesToCreate.length === 1) {
          // No split needed
          await item.update({ status: statusesToCreate[0].status }, { transaction: t });
          
          if (statusesToCreate[0].status === 'problem') {
            anyProblems = true;
            const { Production } = require('../models');
            await Production.create({
              orderId: order.id,
              orderItemId: item.id,
              productModelId: item.productModelId || null,
              stage: 'fabrication',
              status: 'pending',
              notes: '[RETOUR LIVRAISON] Problème signalé par le livreur.',
              quantity: item.quantity,
              taskName: 'Fabrication Globale',
              worker: '',
              basePrice: item.unitPrice
            }, { transaction: t });
          }
        } else if (statusesToCreate.length > 1) {
          // Split needed
          const primary = statusesToCreate.shift();
          await item.update({ status: primary.status, quantity: primary.qty }, { transaction: t });
          
          if (primary.status === 'problem') {
            anyProblems = true;
            const { Production } = require('../models');
            await Production.create({
              orderId: order.id,
              orderItemId: item.id,
              productModelId: item.productModelId || null,
              stage: 'fabrication',
              status: 'pending',
              notes: '[RETOUR LIVRAISON] Problème signalé par le livreur.',
              quantity: primary.qty,
              taskName: 'Fabrication Globale',
              worker: '',
              basePrice: item.unitPrice
            }, { transaction: t });
          }

          for (const st of statusesToCreate) {
            const newItem = await OrderItem.create({
              orderId: item.orderId,
              sofaModel: item.sofaModel,
              quantity: st.qty,
              unitPrice: item.unitPrice,
              fabric: item.fabric,
              color: item.color,
              discountPercentage: item.discountPercentage,
              status: st.status,
              productModelId: item.productModelId
            }, { transaction: t });

            if (st.status === 'problem') {
              anyProblems = true;
              const { Production } = require('../models');
              await Production.create({
                orderId: order.id,
                orderItemId: newItem.id,
                productModelId: newItem.productModelId || null,
                stage: 'fabrication',
                status: 'pending',
                notes: '[RETOUR LIVRAISON] Problème signalé par le livreur.',
                quantity: st.qty,
                taskName: 'Fabrication Globale',
                worker: '',
                basePrice: newItem.unitPrice
              }, { transaction: t });
            }
          }
        }
      }

      // Update Order Status based on Items
      const totalOrderUnits = orderItems.reduce((sum, i) => sum + (i.quantity || 1), 0);
      
      if (orderDeliveredCount === totalOrderUnits) {
        // FULLY DELIVERED
        const totalPaid = await Payment.sum('amount', { where: { orderId: order.id, status: 'completed' }, transaction: t });
        const remainingAmount = Math.max(0, Number(order.totalPrice) - (totalPaid || 0));

        if (remainingAmount > 0) {
          await Payment.create({
            orderId: order.id,
            amount: remainingAmount,
            method: resItem.paymentMethod || 'cash',
            status: 'completed',
            type: 'final',
            paymentDate: new Date(),
            notes: 'Paiement final à la livraison',
          }, { transaction: t });
        }
        await order.update({ status: 'delivered', remainingPayment: 0, paymentStatus: 'fully_paid' }, { transaction: t });
      } else if (orderDeliveredCount > 0) {
        // PARTIALLY DELIVERED
        await order.update({ status: 'partially_delivered' }, { transaction: t });
      } else if (orderProblemCount > 0) {
        // ALL PROBLEM
        await order.update({ status: 'problem', notes: (order.notes || '') + '\n[RETOUR] Problème signalé via livraison.' }, { transaction: t });
      } else if (orderCancelledCount > 0) {
        // ALL CANCELLED
        await order.update({ status: 'cancelled' }, { transaction: t });
      }
    }

    // Always mark the delivery trip itself as 'delivered' so the driver gets their prime.
    // We can add a note if there were some problems.
    let tripNotes = delivery.notes || '';
    if (anyProblems) tripNotes += '\n- Trajet achevé avec des retours/refus.';

    await delivery.update({ 
      status: 'delivered', 
      deliveryDate: delivery.deliveryDate || new Date(),
      notes: tripNotes
    }, { transaction: t });

    await t.commit();
    res.json({ message: 'Résolutions appliquées et trajet de livraison achevé.' });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error('Confirm Delivery Error:', error);
    res.status(500).json({ error: 'Erreur serveur: ' + error.message });
  }
});

// DELETE /api/deliveries/:id
router.delete('/:id', authenticate, authorize('admin', 'delivery', 'gerant'), async (req, res) => {
  const t = await Delivery.sequelize.transaction();
  try {
    const delivery = await Delivery.findByPk(req.params.id, {
      include: [{ model: Order, as: 'order' }],
      transaction: t
    });
    if (!delivery) {
      await t.rollback();
      return res.status(404).json({ error: 'Delivery not found.' });
    }

    // If it was delivered, reverse the stock changes before deleting
    if (delivery.status === 'delivered') {
      const { LocationStock } = require('../models');

      if (delivery.type === 'transfer') {
        const items = await TransferDeliveryItem.findAll({ where: { deliveryId: delivery.id }, transaction: t });
        for (const item of items) {
          // Reverse: add back to source
          if (delivery.sourceLocationId) {
            const [srcStock] = await LocationStock.findOrCreate({
              where: { locationId: delivery.sourceLocationId, productModelId: item.productModelId },
              defaults: { quantity: 0 }, transaction: t, lock: t.LOCK.UPDATE
            });
            await srcStock.update({ quantity: srcStock.quantity + item.quantity }, { transaction: t });
          }
          // Reverse: remove from destination
          if (delivery.destLocationId) {
            const dstStock = await LocationStock.findOne({
              where: { locationId: delivery.destLocationId, productModelId: item.productModelId },
              transaction: t, lock: t.LOCK.UPDATE
            });
            if (dstStock) {
              await dstStock.update({ quantity: Math.max(0, dstStock.quantity - item.quantity) }, { transaction: t });
            }
          }
        }
      } else if (delivery.type === 'order' && delivery.order) {
        // Reverse client delivery: add stock back
        const orderItem = await OrderItem.findOne({ where: { orderId: delivery.order.id }, transaction: t });
        let pm = null;
        if (orderItem?.productModelId) {
          pm = await ProductModel.findByPk(orderItem.productModelId, { transaction: t, lock: t.LOCK.UPDATE });
        }
        if (!pm) {
          pm = await ProductModel.findOne({ where: { name: delivery.order.sofaModel }, transaction: t, lock: t.LOCK.UPDATE });
        }
        if (pm) {
          await pm.update({ stock: pm.stock + (delivery.order.quantity || 1) }, { transaction: t });
          if (delivery.sourceLocationId) {
            const [locStock] = await LocationStock.findOrCreate({
              where: { locationId: delivery.sourceLocationId, productModelId: pm.id },
              defaults: { quantity: 0 }, transaction: t, lock: t.LOCK.UPDATE
            });
            await locStock.update({ quantity: locStock.quantity + (delivery.order.quantity || 1) }, { transaction: t });
          }
        }
        // Remove final payment and reset order
        await Payment.destroy({ where: { orderId: delivery.order.id, type: 'final' }, transaction: t });
        await delivery.order.update({ status: 'ready', paymentStatus: 'advance_paid', remainingPayment: 0 }, { transaction: t });
      }
    }

    // Delete delivery orders junction records
    await DeliveryOrder.destroy({ where: { deliveryId: delivery.id }, transaction: t });
    // Delete transfer items first (FK constraint)
    await TransferDeliveryItem.destroy({ where: { deliveryId: delivery.id }, transaction: t });
    await delivery.destroy({ transaction: t });
    await t.commit();
    res.json({ message: 'Delivery deleted.' });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error('Delete Delivery Error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
