const express = require('express');
const router = express.Router();
const sequelize = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

// GET all available tables
router.get('/tables', authenticate, authorize('admin'), async (req, res) => {
  try {
    const tables = await sequelize.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;",
      { type: sequelize.QueryTypes.SELECT }
    );
    res.json(tables.map(t => t.table_name));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET raw data from a specific table
router.get('/query/:table', authenticate, authorize('admin'), async (req, res) => {
  const { table } = req.params;
  const limit = req.query.limit || 50;
  
  // Basic query validation to prevent SQL injection (whitelisting only existing tables)
  try {
    const tableListResult = await sequelize.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';",
      { type: sequelize.QueryTypes.SELECT }
    );
    const tableList = tableListResult.map(t => t.table_name);
    
    if (!tableList.includes(table)) {
      return res.status(400).json({ error: 'Invalid table name' });
    }

    const data = await sequelize.query(`SELECT * FROM "${table}" LIMIT :limit`, {
      replacements: { limit: parseInt(limit) },
      type: sequelize.QueryTypes.SELECT
    });
    
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
