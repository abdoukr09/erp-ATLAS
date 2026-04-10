/**
 * TASK 5: Safe Error Handler
 * Replaces the default Express error handler.
 * - In production: returns generic { error: "Internal server error" }
 * - Always logs the full stack trace server-side for debugging
 * - Handles known Sequelize errors gracefully
 */

const errorHandler = (err, req, res, next) => {
  // Always log full error server-side
  console.error(`[${new Date().toISOString()}] ERROR on ${req.method} ${req.originalUrl}:`, err);

  // Handle Sequelize-specific errors with useful messages
  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    const messages = err.errors ? err.errors.map(e => e.message) : [err.message];
    return res.status(400).json({ error: 'Validation failed', details: messages });
  }

  if (err.name === 'SequelizeDatabaseError') {
    return res.status(500).json({ error: 'Database error. Please contact support.' });
  }

  if (err.name === 'SequelizeConnectionError') {
    return res.status(503).json({ error: `DEBUG DB CONNECTION: ${err.message}` });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }

  // Temporarily force stack trace/messages to surface to Vercel for live debugging
  res.status(err.status || 500).json({
    error: `DEBUG RAW: ${err.message}`,
    stack: err.stack,
  });
};

module.exports = errorHandler;
