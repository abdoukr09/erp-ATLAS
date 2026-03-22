/**
 * LEVEL 6: Logging & Monitoring
 * Uses Morgan and rotating-file-stream to create a permanent, daily rotated
 * audit trail of all API accesses.
 * Outputs format: IP - UserID - [Date] "Method URL" Status ResponseTime ms
 */
const morgan = require('morgan');
const path = require('path');
const rfs = require('rotating-file-stream');
const fs = require('fs');

// Ensure log directory exists
const logDirectory = path.join(__dirname, '../logs');
if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory);
}

// Create a rotating write stream (one file per day)
const accessLogStream = rfs.createStream('access.log', {
  interval: '1d', // rotate daily
  path: logDirectory,
  maxFiles: 30, // keep 30 days of logs
});

// Custom Morgan token to extract authenticated User ID if present
morgan.token('user-id', (req) => {
  return req.user ? `User:${req.user.id}` : 'Guest';
});

// Define the log format
const logFormat = ':remote-addr - :user-id - [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] - :response-time ms';

// Create the middleware instances
const fileLogger = morgan(logFormat, { stream: accessLogStream });
const consoleLogger = morgan('dev', {
  skip: (req, res) => process.env.NODE_ENV === 'test' // Don't spam console during tests
});

module.exports = { fileLogger, consoleLogger };
