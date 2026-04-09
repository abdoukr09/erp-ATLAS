const router = require('express').Router();
const { Op } = require('sequelize');
const { authenticate, authorize } = require('../middleware/auth');
const {
  Production, ProductionWorker, Employee, WorkerType,
  Order, OrderItem, Customer, Payment, EmployeePayment,
  Delivery, AuditLog, ProductModel, User
} = require('../models');

// GET /api/reports/daily?date=YYYY-MM-DD
router.get('/daily', authenticate, authorize('admin'), async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const startOfDay = `${date} 00:00:00`;
    const endOfDay = `${date} 23:59:59`;

    // 1. Productions created or completed today
    const productions = await Production.findAll({
      where: {
        [Op.or]: [
          { createdAt: { [Op.between]: [startOfDay, endOfDay] } },
          { completionDate: date }
        ]
      },
      include: [
        { model: OrderItem, as: 'orderItem', attributes: ['id', 'sofaModel', 'quantity'], include: [{ model: Order, as: 'order', attributes: ['id'], include: [{ model: Customer, as: 'customer', attributes: ['name'] }] }] },
        { model: ProductModel, as: 'productModel', attributes: ['id', 'name', 'basePrice'] },
        {
          model: ProductionWorker, as: 'workerAssignments', include: [
            { model: Employee, as: 'worker', attributes: ['id', 'name'] },
            { model: WorkerType, as: 'workerType', attributes: ['id', 'name'], required: false }
          ]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    // 2. Employee payments made today
    const employeePayments = await EmployeePayment.findAll({
      where: { date },
      include: [{ model: Employee, as: 'employee', attributes: ['id', 'name', 'category', 'baseSalary', 'commissionRate'] }],
      order: [['createdAt', 'DESC']]
    });

    // 3. Orders created or modified today
    const orders = await Order.findAll({
      where: {
        [Op.or]: [
          { createdAt: { [Op.between]: [startOfDay, endOfDay] } },
          { updatedAt: { [Op.between]: [startOfDay, endOfDay] } }
        ]
      },
      include: [
        { model: Customer, as: 'customer', attributes: ['name'] },
        { model: OrderItem, as: 'items', attributes: ['sofaModel', 'quantity', 'status'] }
      ],
      order: [['updatedAt', 'DESC']]
    });

    // 4. Customer payments received today
    const customerPayments = await Payment.findAll({
      where: { paymentDate: date },
      include: [{ model: Order, as: 'order', attributes: ['id'], include: [{ model: Customer, as: 'customer', attributes: ['name'] }] }],
      order: [['createdAt', 'DESC']]
    });

    // 5. Deliveries today
    const deliveries = await Delivery.findAll({
      where: { deliveryDate: date },
      include: [{ model: Order, as: 'order', attributes: ['id'], include: [{ model: Customer, as: 'customer', attributes: ['name'] }] }],
      order: [['createdAt', 'DESC']]
    });

    // 6. Audit log modifications today
    const auditLogs = await AuditLog.findAll({
      where: { createdAt: { [Op.between]: [startOfDay, endOfDay] } },
      order: [['createdAt', 'DESC']],
      limit: 100
    });

    // Enrich audit logs with user names
    const userIds = [...new Set(auditLogs.filter(a => a.userId).map(a => a.userId))];
    let userMap = {};
    if (userIds.length > 0) {
      const users = await User.findAll({ where: { id: userIds }, attributes: ['id', 'fullName'] });
      users.forEach(u => { userMap[u.id] = u.fullName; });
    }

    const enrichedAudits = auditLogs.map(a => ({
      ...a.toJSON(),
      userName: a.userId ? (userMap[a.userId] || `User #${a.userId}`) : 'Système'
    }));

    res.json({
      date,
      summary: {
        productionsCount: productions.length,
        employeePaymentsCount: employeePayments.length,
        employeePaymentsTotal: employeePayments.reduce((s, p) => s + Number(p.amount), 0),
        ordersCount: orders.length,
        customerPaymentsCount: customerPayments.length,
        customerPaymentsTotal: customerPayments.reduce((s, p) => s + Number(p.amount), 0),
        deliveriesCount: deliveries.length,
        modificationsCount: enrichedAudits.length
      },
      productions,
      employeePayments,
      orders,
      customerPayments,
      deliveries,
      auditLogs: enrichedAudits
    });
  } catch (error) {
    console.error('Report error:', error.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
