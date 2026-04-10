require('dotenv').config({ path: __dirname + '/.env' });
const sequelize = require('./config/database');

async function resetData() {
  try {
    await sequelize.authenticate();
    
    // Exact table names used by Sequelize in postgres
    const tables = [
      'Payments', 'EmployeePayments', 'Productions', 'OrderItems', 
      'Orders', 'StockTransactions', 'Expenses', 'Employees', 'Customers'
    ];

    for (const table of tables) {
      await sequelize.query(`TRUNCATE TABLE "${table}" CASCADE;`);
      console.log(`Cleared ${table}`);
    }

  } finally {
    process.exit();
  }
}
resetData();
