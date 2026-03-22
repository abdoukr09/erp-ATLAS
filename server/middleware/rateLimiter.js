/**
 * TASK 1: Rate Limiting
 * - General API: 100 requests per 15 minutes
 * - Login: 5 requests per minute (brute-force protection)
 * - Critical writes (orders, payments): 30 requests per minute
 */
const rateLimit = require('express-rate-limit');

const standardResponse = (req, res) => {
  res.status(429).json({ error: 'Too many requests, please try again later.' });
};

// Simple IP-only limiter — no custom keyGenerator needed (avoids IPv6 warning)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardResponse,
});

// Strict limiter for /api/auth/login (5 per minute)
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardResponse,
});

// Moderate limiter for write routes — orders, payments (30 per minute)
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardResponse,
});

module.exports = { generalLimiter, loginLimiter, writeLimiter };

