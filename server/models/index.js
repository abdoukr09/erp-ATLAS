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

// Associations
Customer.hasMany(Order, { foreignKey: 'customerId', as: 'orders' });
Order.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });

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

Employee.hasMany(Order, { foreignKey: 'salesmanId', as: 'sales' });
Order.belongsTo(Employee, { foreignKey: 'salesmanId', as: 'salesman' });

// Order Item & Salesman Associations
Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'items', onDelete: 'CASCADE' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

Order.hasMany(OrderSalesman, { foreignKey: 'orderId', as: 'salesmen', onDelete: 'CASCADE' });
OrderSalesman.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });
OrderSalesman.belongsTo(Employee, { foreignKey: 'salesmanId', as: 'salesman' });

OrderItem.hasMany(Production, { foreignKey: 'orderItemId', as: 'productions', onDelete: 'CASCADE' });
Production.belongsTo(OrderItem, { foreignKey: 'orderItemId', as: 'orderItem' });

Production.hasMany(ProductionWorker, { foreignKey: 'productionId', as: 'workerAssignments', onDelete: 'CASCADE' });
ProductionWorker.belongsTo(Production, { foreignKey: 'productionId', as: 'production' });
ProductionWorker.belongsTo(Employee, { foreignKey: 'workerId', as: 'worker' });

// Material Reservation Associations
Order.hasMany(MaterialReservation, { foreignKey: 'orderId', as: 'reservations', onDelete: 'CASCADE' });
MaterialReservation.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });
Material.hasMany(MaterialReservation, { foreignKey: 'materialId', as: 'reservations' });
MaterialReservation.belongsTo(Material, { foreignKey: 'materialId', as: 'material' });

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
  RefreshToken
};
