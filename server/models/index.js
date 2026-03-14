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
};
