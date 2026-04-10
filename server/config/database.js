const { Sequelize } = require('sequelize');
require('dotenv').config();

// Force the underlying pg driver to accept self-signed certificates globally
const pg = require('pg');
pg.defaults.ssl = {
  rejectUnauthorized: false
};

// Supabase injects POSTGRES_URL or DATABASE_URL directly into Vercel.
const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

let sequelize;

if (connectionString) {
  sequelize = new Sequelize(connectionString, {
    dialect: 'postgres',
    protocol: 'postgres',
    logging: false,
    dialectModule: require('pg'), // Critical for Vercel Serverless bundling
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false // Bypasses self-signed cert block
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
