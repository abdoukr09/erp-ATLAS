const User = require('./User');
const Customer = require('./Customer');
const Material = require('./Material');
const Order = require('./Order');
const Production = require('./Production');
const Delivery = require('./Delivery');
const Payment = require('./Payment');
const ProductModel = require('./ProductModel');
const ModelMaterial = require('./ModelMaterial');
const PackItem = require('./PackItem');
const Expense = require('./Expense');
const Employee = require('./Employee');
const EmployeePayment = require('./EmployeePayment');
const OrderItem = require('./OrderItem');
const OrderSalesman = require('./OrderSalesman');
const ProductionWorker = require('./ProductionWorker');
const MaterialReservation = require('./MaterialReservation');
const RefreshToken = require('./RefreshToken');
const AuditLog = require('./AuditLog');
const WorkerType = require('./WorkerType');
const WorkerTypeTariff = require('./WorkerTypeTariff');
const Location = require('./Location');
const LocationStock = require('./LocationStock');
const TransferDeliveryItem = require('./TransferDeliveryItem');
const DeliveryRoutePrime = require('./DeliveryRoutePrime');
const DeliveryOrder = require('./DeliveryOrder');

// Associations
Customer.hasMany(Order, { foreignKey: 'customerId', as: 'orders', onDelete: 'SET NULL' });
Order.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer', onDelete: 'SET NULL' });

Order.hasMany(Production, { foreignKey: 'orderId', as: 'productions', onDelete: 'CASCADE' });
Production.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

Order.hasMany(Delivery, { foreignKey: 'orderId', as: 'deliveries', onDelete: 'CASCADE' });
Delivery.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

Order.hasMany(Payment, { foreignKey: 'orderId', as: 'payments', onDelete: 'CASCADE' });
Payment.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

// Employee Associations
Employee.hasMany(EmployeePayment, { foreignKey: 'employeeId', as: 'payments', onDelete: 'CASCADE' });
EmployeePayment.belongsTo(Employee, { foreignKey: 'employeeId', as: 'employee' });

// BOM Associations
ProductModel.belongsToMany(Material, { through: ModelMaterial, foreignKey: 'modelId', as: 'materials' });
Material.belongsToMany(ProductModel, { through: ModelMaterial, foreignKey: 'materialId', as: 'models' });

// Explicit Junction Associations (Needed for custom includes)
ProductModel.hasMany(ModelMaterial, { foreignKey: 'modelId', as: 'bomEntries' });
ModelMaterial.belongsTo(ProductModel, { foreignKey: 'modelId', as: 'productModel' });

Material.hasMany(ModelMaterial, { foreignKey: 'materialId', as: 'modelEntries' });
ModelMaterial.belongsTo(Material, { foreignKey: 'materialId', as: 'material' });

// Pack Associations
ProductModel.hasMany(PackItem, { foreignKey: 'packId', as: 'packItems', onDelete: 'CASCADE' });
PackItem.belongsTo(ProductModel, { foreignKey: 'packId', as: 'pack' });
PackItem.belongsTo(ProductModel, { foreignKey: 'productId', as: 'product' });

ProductModel.hasMany(Production, { foreignKey: 'productModelId', as: 'stockProductions' });
Production.belongsTo(ProductModel, { foreignKey: 'productModelId', as: 'productModel' });

Employee.hasMany(Order, { foreignKey: 'salesmanId', as: 'sales', onDelete: 'SET NULL' });
Order.belongsTo(Employee, { foreignKey: 'salesmanId', as: 'salesman', onDelete: 'SET NULL' });

// Order Item & Salesman Associations
Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'items', onDelete: 'CASCADE' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

Order.hasMany(OrderSalesman, { foreignKey: 'orderId', as: 'salesmen', onDelete: 'CASCADE' });
OrderSalesman.belongsTo(Order, { foreignKey: 'orderId', as: 'order', onDelete: 'CASCADE' });
OrderSalesman.belongsTo(Employee, { foreignKey: 'salesmanId', as: 'salesman', onDelete: 'CASCADE' });
Employee.hasMany(OrderSalesman, { foreignKey: 'salesmanId', as: 'orderInvolvements', onDelete: 'CASCADE' });

OrderItem.hasMany(Production, { foreignKey: 'orderItemId', as: 'productions', onDelete: 'CASCADE' });
Production.belongsTo(OrderItem, { foreignKey: 'orderItemId', as: 'orderItem' });

Production.hasMany(ProductionWorker, { foreignKey: 'productionId', as: 'workerAssignments', onDelete: 'CASCADE' });
ProductionWorker.belongsTo(Production, { foreignKey: 'productionId', as: 'production', onDelete: 'CASCADE' });
ProductionWorker.belongsTo(Employee, { foreignKey: 'workerId', as: 'worker', onDelete: 'CASCADE' });
Employee.hasMany(ProductionWorker, { foreignKey: 'workerId', as: 'productionInvolvements', onDelete: 'CASCADE' });

// Worker Type Associations
WorkerType.hasMany(WorkerTypeTariff, { foreignKey: 'workerTypeId', as: 'tariffs', onDelete: 'CASCADE' });
WorkerTypeTariff.belongsTo(WorkerType, { foreignKey: 'workerTypeId', as: 'workerType' });
ProductModel.hasMany(WorkerTypeTariff, { foreignKey: 'productModelId', as: 'workerTypeTariffs', onDelete: 'CASCADE' });
WorkerTypeTariff.belongsTo(ProductModel, { foreignKey: 'productModelId', as: 'productModel' });
WorkerType.hasMany(ProductionWorker, { foreignKey: 'workerTypeId', as: 'productionWorkers' });
ProductionWorker.belongsTo(WorkerType, { foreignKey: 'workerTypeId', as: 'workerType' });

// Material Reservation Associations
Order.hasMany(MaterialReservation, { foreignKey: 'orderId', as: 'reservations', onDelete: 'CASCADE' });
MaterialReservation.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });
Material.hasMany(MaterialReservation, { foreignKey: 'materialId', as: 'reservations' });
MaterialReservation.belongsTo(Material, { foreignKey: 'materialId', as: 'material' });

// Location & Stock Associations
Location.hasMany(LocationStock, { foreignKey: 'locationId', as: 'stocks', onDelete: 'CASCADE' });
LocationStock.belongsTo(Location, { foreignKey: 'locationId', as: 'location' });

ProductModel.hasMany(LocationStock, { foreignKey: 'productModelId', as: 'locationStocks', onDelete: 'CASCADE' });
LocationStock.belongsTo(ProductModel, { foreignKey: 'productModelId', as: 'productModel' });

Location.hasMany(Production, { foreignKey: 'destLocationId', as: 'productions' });
Production.belongsTo(Location, { foreignKey: 'destLocationId', as: 'destLocation' });

Location.hasMany(Delivery, { foreignKey: 'sourceLocationId', as: 'sourceDeliveries' });
Delivery.belongsTo(Location, { foreignKey: 'sourceLocationId', as: 'sourceLocation' });

Location.hasMany(Delivery, { foreignKey: 'destLocationId', as: 'destDeliveries' });
Delivery.belongsTo(Location, { foreignKey: 'destLocationId', as: 'destLocation' });

Delivery.hasMany(TransferDeliveryItem, { foreignKey: 'deliveryId', as: 'transferItems', onDelete: 'CASCADE' });
TransferDeliveryItem.belongsTo(Delivery, { foreignKey: 'deliveryId', as: 'delivery' });

ProductModel.hasMany(TransferDeliveryItem, { foreignKey: 'productModelId', as: 'transferInvolvements' });
TransferDeliveryItem.belongsTo(ProductModel, { foreignKey: 'productModelId', as: 'productModel' });

// Delivery Driver (Livreur) Associations
Employee.hasMany(Delivery, { foreignKey: 'driverId', as: 'driverDeliveries' });
Delivery.belongsTo(Employee, { foreignKey: 'driverId', as: 'driverEmployee' });

// Delivery ↔ Order (Many-to-Many via DeliveryOrder)
Delivery.hasMany(DeliveryOrder, { foreignKey: 'deliveryId', as: 'deliveryOrders', onDelete: 'CASCADE' });
DeliveryOrder.belongsTo(Delivery, { foreignKey: 'deliveryId', as: 'delivery' });
Order.hasMany(DeliveryOrder, { foreignKey: 'orderId', as: 'deliveryLinks', onDelete: 'CASCADE' });
DeliveryOrder.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

// Delivery Route Prime Associations
Location.hasMany(DeliveryRoutePrime, { foreignKey: 'sourceLocationId', as: 'sourceRoutePrimes' });
DeliveryRoutePrime.belongsTo(Location, { foreignKey: 'sourceLocationId', as: 'sourceLocation' });
Location.hasMany(DeliveryRoutePrime, { foreignKey: 'destLocationId', as: 'destRoutePrimes' });
DeliveryRoutePrime.belongsTo(Location, { foreignKey: 'destLocationId', as: 'destLocation' });

module.exports = {
  User,
  Customer,
  Material,
  Order,
  Production,
  Delivery,
  Payment,
  ProductModel,
  ModelMaterial,
  PackItem,
  Expense,
  Employee,
  EmployeePayment,
  OrderItem,
  OrderSalesman,
  ProductionWorker,
  MaterialReservation,
  RefreshToken,
  AuditLog,
  WorkerType,
  WorkerTypeTariff,
  Location,
  LocationStock,
  TransferDeliveryItem,
  DeliveryRoutePrime,
  DeliveryOrder
};

// ─── LEVEL 10: Enterprise Audit Trail (Global Hooks) ───────────────────────
// Automatically record state transitions without modifying business controllers.
const AUDITABLE_MODELS = [
  'Order', 'Payment', 'Customer', 'ProductModel', 
  'Material', 'Employee', 'Production', 'Delivery', 'Expense'
];

for (const modelName of AUDITABLE_MODELS) {
  const model = module.exports[modelName];
  if (model) {
    model.addHook('afterUpdate', async (instance, options) => {
      // Find what exactly changed
      const changedKeys = instance.changed() || [];
      if (changedKeys.length === 0) return;

      const oldValues = {};
      const newValues = {};
      
      changedKeys.forEach(key => {
        oldValues[key] = instance.previous(key);
        newValues[key] = instance.get(key);
      });

      try {
        await AuditLog.create({
          action: 'UPDATE',
          modelName,
          recordId: instance.id,
          userId: options?.user?.id || null, // Best-effort user attribution
          oldValues,
          newValues
        });
      } catch (err) {
        console.error('AuditLog Error:', err);
      }
    });

    model.addHook('afterDestroy', async (instance, options) => {
      try {
        await AuditLog.create({
          action: 'DELETE',
          modelName,
          recordId: instance.id,
          userId: options?.user?.id || null,
          oldValues: instance.get(),
          newValues: null
        });
      } catch (err) {
        console.error('AuditLog Error:', err);
      }
    });
  }
}
