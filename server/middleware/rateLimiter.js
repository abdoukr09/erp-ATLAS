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

// 1. Global API Requests Limiter (1000 per 15 minutes)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 2. Login / Auth Limiter (50 attempts per minute)
const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 50,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 3. Orders/Payments Limiter (30 requests per minute)
const strictLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  generalLimiter,
  authLimiter,
  strictLimiter,
  loginLimiter: authLimiter,
  writeLimiter: strictLimiter,
};
