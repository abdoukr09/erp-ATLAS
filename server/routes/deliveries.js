const express = require('express');
const { Delivery, Order, Payment, OrderItem, Location, TransferDeliveryItem, ProductModel } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

// GET /api/deliveries
router.get('/', authenticate, authorize('admin', 'delivery', 'gerant'), async (req, res) => {
  try {
    const { Customer } = require('../models');
    const deliveries = await Delivery.findAll({
      include: [
        { 
          model: Order, 
          as: 'order', 
          attributes: ['id', 'status', 'totalPrice', 'advancePayment', 'remainingPayment', 'paymentStatus', 'deliveryAddress', 'sofaModel', 'quantity'],
          include: [
            { model: Customer, as: 'customer', attributes: ['name', 'phone', 'address'] },
            { model: OrderItem, as: 'items', attributes: ['id', 'sofaModel', 'quantity', 'status'] }
          ]
        },
        { model: Location, as: 'sourceLocation', attributes: ['id', 'name', 'color'] },
        { model: Location, as: 'destLocation', attributes: ['id', 'name', 'color'] },
        { 
          model: TransferDeliveryItem, 
          as: 'transferItems', 
          include: [{ model: ProductModel, as: 'productModel', attributes: ['id', 'name'] }] 
        }
      ],
      order: [['createdAt', 'DESC']],
    });
    res.json(deliveries);
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/deliveries
router.post('/', authenticate, authorize('admin', 'delivery', 'gerant'), async (req, res) => {
  const t = await Delivery.sequelize.transaction();
  try {
    const { orderId, driver, deliveryDate, address, notes, type, sourceLocationId, destLocationId, transferItems } = req.body;
    
    if (type === 'transfer') {
      const delivery = await Delivery.create({
        type: 'transfer',
        driver,
        deliveryDate,
        address: address || 'Transfert Interne',
        notes,
        sourceLocationId: sourceLocationId || null, // null = Usine
        destLocationId: destLocationId || null,
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
      return res.status(201).json(delivery);
    }

    if (!orderId) {
      await t.rollback();
      return res.status(400).json({ error: 'Order ID is required.' });
    }

    const order = await Order.findByPk(orderId, { transaction: t });
    if (!order) {
      await t.rollback();
      return res.status(404).json({ error: 'Order not found.' });
    }

    const delivery = await Delivery.create({
      orderId, driver, deliveryDate,
      address: address || order.deliveryAddress,
      notes,
      type: 'order',
      sourceLocationId: sourceLocationId || null,
    }, { transaction: t });

    await t.commit();
    res.status(201).json(delivery);
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

    const newStatus = req.body.status;
    const wasDelivered = delivery.status === 'delivered';
    const willBeDelivered = newStatus === 'delivered';
    const wasCancelled = delivery.status === 'cancelled';
    const willBeCancelled = newStatus === 'cancelled';

    if (delivery.type === 'order' && delivery.order) {
      // Changing FROM delivered → something else: reverse the final payment and replenish stock
      if (wasDelivered && !willBeDelivered) {
        await Payment.destroy({
          where: { orderId: delivery.order.id, type: 'final' },
          transaction: t,
        });

        // Replenish stock if it was delivered from a showroom
        if (delivery.sourceLocationId) {
          const { LocationStock } = require('../models');
          const sofaModelName = delivery.order.sofaModel;
          const { ProductModel } = require('../models');
          const pm = await ProductModel.findOne({ where: { name: sofaModelName }, transaction: t });
          if (pm) {
            const locStock = await LocationStock.findOne({
              where: { locationId: delivery.sourceLocationId, productModelId: pm.id },
              transaction: t,
              lock: t.LOCK.UPDATE
            });
            if (locStock) {
              await locStock.update({ quantity: locStock.quantity + (delivery.order.quantity || 1) }, { transaction: t });
            }
          }
        }

        const hadAdvance = Number(delivery.order.advancePayment) > 0;
        await delivery.order.update({
          status: 'ready',
          remainingPayment: 0,
          paymentStatus: hadAdvance ? 'advance_paid' : 'unpaid',
        }, { transaction: t });
      }

      // Changing TO delivered (and wasn't before): create the final payment and DECREASE stock
      if (!wasDelivered && willBeDelivered) {
        // Calculate SUM of all existing completed payments
        const totalPaid = await Payment.sum('amount', { 
          where: { orderId: delivery.order.id, status: 'completed' },
          transaction: t 
        });
        const remainingAmount = Math.max(0, Number(delivery.order.totalPrice) - (totalPaid || 0));

        // Remove any accidental duplicates first
        await Payment.destroy({
          where: { orderId: delivery.order.id, type: 'final' },
          transaction: t,
        });

        if (remainingAmount > 0) {
          await Payment.create({
            orderId: delivery.order.id,
            amount: remainingAmount,
            method: req.body.paymentMethod || 'cash',
            status: 'completed',
            type: 'final',
            paymentDate: new Date(),
            notes: 'Paiement final à la livraison',
          }, { transaction: t });
        }

        // DECREASE stock if it's coming from a location
        if (delivery.sourceLocationId) {
          const { LocationStock, ProductModel } = require('../models');
          const pm = await ProductModel.findOne({ where: { name: delivery.order.sofaModel }, transaction: t });
          if (pm) {
             const locStock = await LocationStock.findOne({
               where: { locationId: delivery.sourceLocationId, productModelId: pm.id },
               transaction: t,
               lock: t.LOCK.UPDATE
             });
             if (locStock) {
               await locStock.update({ quantity: Math.max(0, locStock.quantity - (delivery.order.quantity || 1)) }, { transaction: t });
             }
             // Also decrease global stock because it LEFT the company
             await pm.update({ stock: Math.max(0, pm.stock - (delivery.order.quantity || 1)) }, { transaction: t });
          }
        } else {
           // Standard Usine delivery: just decrease global stock
           const { ProductModel } = require('../models');
           const pm = await ProductModel.findOne({ where: { name: delivery.order.sofaModel }, transaction: t });
           if (pm) {
             await pm.update({ stock: Math.max(0, pm.stock - (delivery.order.quantity || 1)) }, { transaction: t });
           }
        }

        await delivery.order.update({
          status: 'delivered',
          remainingPayment: 0,
          paymentStatus: 'fully_paid',
        }, { transaction: t });
      }

      // Changing TO cancelled: increase stock, set order to cancelled
      if (!wasCancelled && willBeCancelled) {
        const { ProductModel } = require('../models');
        const model = await ProductModel.findOne({ where: { name: delivery.order.sofaModel }, transaction: t });
        
        if (model) {
          // If it was coming from a location, we need to return it there?
          // For now, return to Global Stock as requested: "product will be written as annuler till marks it in a location"
          // Let's just return to Global Stock (Usine) by default as existing logic does.
          await model.update({ stock: model.stock + (delivery.order.quantity || 1) }, { transaction: t });
        }
        await delivery.order.update({ status: 'cancelled' }, { transaction: t });
      }

      // Changing FROM cancelled: decrease stock, set order to ready
      if (wasCancelled && !willBeCancelled) {
        const { ProductModel } = require('../models');
        const model = await ProductModel.findOne({ where: { name: delivery.order.sofaModel }, transaction: t });
        if (model) {
          const qtyNeeded = delivery.order.quantity || 1;
          if (model.stock >= qtyNeeded) {
            await model.update({ stock: model.stock - qtyNeeded }, { transaction: t });
            await delivery.order.update({ status: 'ready' }, { transaction: t });
          } else {
            await t.rollback();
            return res.status(400).json({ error: 'Stock insuffisant pour rétablir cette livraison.' });
          }
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
    res.json(delivery);
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error('Update Delivery Error:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// POST /api/deliveries/:id/confirm - Confirm delivery & record final payment
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
    if (!delivery.order) {
      await t.rollback();
      return res.status(400).json({ error: 'Aucune commande associée à cette livraison.' });
    }

    const order = delivery.order;
    
    // Calculate SUM of all existing completed payments
    const totalPaid = await Payment.sum('amount', { 
      where: { orderId: order.id, status: 'completed' },
      transaction: t 
    });
    const remainingAmount = Math.max(0, Number(order.totalPrice) - (totalPaid || 0));

    // 1. Mark delivery as delivered
    await delivery.update({ status: 'delivered', deliveryDate: delivery.deliveryDate || new Date() }, { transaction: t });

    // 2. Mark order as delivered
    await order.update({
      status: 'delivered',
      remainingPayment: 0,
      paymentStatus: 'fully_paid',
    }, { transaction: t });

    // 3. Create final payment record (only if there is a remaining balance)
    let finalPayment = null;
    if (remainingAmount > 0) {
      finalPayment = await Payment.create({
        orderId: order.id,
        amount: remainingAmount,
        method: req.body.paymentMethod || 'cash',
        status: 'completed',
        type: 'final',
        paymentDate: new Date(),
        notes: 'Paiement final à la livraison',
      }, { transaction: t });
    }

    await t.commit();

    res.json({
      message: 'Livraison confirmée et paiement final enregistré.',
      delivery,
      order,
      finalPayment,
      remainingAmount,
    });
  } catch (error) {
    await t.rollback();
    console.error('Confirm Delivery Error:', error);
    res.status(500).json({ error: 'Erreur serveur: ' + error.message });
  }
});

// DELETE /api/deliveries/:id
router.delete('/:id', authenticate, authorize('admin', 'delivery', 'gerant'), async (req, res) => {
  try {
    const delivery = await Delivery.findByPk(req.params.id);
    if (!delivery) return res.status(404).json({ error: 'Delivery not found.' });

    await delivery.destroy();
    res.json({ message: 'Delivery deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
