/**
 * Rate Limiting — Production-tuned for 50+ concurrent ERP users.
 * - General API: 5000 requests per 15 minutes per IP
 * - Login: 20 attempts per minute (brute-force protection)
 * - Critical writes (orders, payments, production): 200 requests per minute per IP
 */
const rateLimit = require('express-rate-limit');

const standardResponse = (req, res) => {
  res.status(429).json({ error: 'Too many requests, please try again later.' });
};

// 1. Global API Requests Limiter (5000 per 15 minutes per IP)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 2. Login / Auth Limiter (20 attempts per minute — still blocks brute-force)
const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 20,
  message: { error: 'Too many login attempts. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 3. Orders/Payments/Production Limiter (200 requests per minute per IP)
const strictLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 4. Dashboard Limiter (60 requests per minute - heavy aggregation queries)
const dashboardLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  message: { error: 'Too many dashboard requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  generalLimiter,
  authLimiter,
  strictLimiter,
  dashboardLimiter,
  loginLimiter: authLimiter,
  writeLimiter: strictLimiter,
};
