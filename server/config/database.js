const { Sequelize } = require('sequelize');
require('dotenv').config();

// Supabase injects POSTGRES_URL or DATABASE_URL directly into Vercel.
const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

let sequelize;

if (connectionString) {
  // Cloud Database Connection (Vercel / Supabase)
  sequelize = new Sequelize(connectionString, {
    dialect: 'postgres',
    logging: false,
    dialectModule: require('pg'), // Critical for Vercel Serverless bundling
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  });
} else {
  // Local Database Connection (Your Laptop)
  sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD || null,
    {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      dialect: 'postgres',
      logging: false,
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
    }
  );
}

module.exports = sequelize;
