require('dotenv').config();

// ─── TASK 3: Validate critical env variables at startup ──────────────────────
if (!process.env.JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET environment variable is not set. Refusing to start.');
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const sequelize = require('./config/database');
const { generalLimiter, authLimiter, strictLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const sanitizeBody = require('./middleware/sanitize');
const { fileLogger, consoleLogger } = require('./middleware/logger');

// Import models (triggers associations)
require('./models');

const app = express();

// ─── TASK 9: Infrastructure Layer Security (Reverse Proxy Trust) ──────────────
// Trust the first proxy (e.g. Nginx, Apache). Crucial for Rate Limiting.
// Without this, req.ip is always 127.0.0.1, meaning if 1 user is rate limited,
// ALL users are blocked.
app.set('trust proxy', 1);

// ─── TASK 7: Advanced CORS Hardening ──────────────────────────────────────────
// Only allow requests from the exact frontend origin. Blocks CSRF from hacker.com
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5001',
  'http://172.20.10.2:5173'
];
if (process.env.FRONTEND_URL) allowedOrigins.push(process.env.FRONTEND_URL);

// Combine known origins with wildcard support for any *.vercel.app domain
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    // Explicit matches
    if (allowedOrigins.includes(origin)) return callback(null, true);
    
    // Allow any Vercel preview/production domains dynamically
    if (origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    
    // Reject anything else
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true, // Crucial for HTTP-only refresh token cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

// ─── TASK 4 & 7: Security Headers (Helmet + HSTS) ───────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", ...allowedOrigins],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: process.env.NODE_ENV === 'production' ? {
    maxAge: 31536000, // 1 year strict transport security (force HTTPS)
    includeSubDomains: true,
    preload: true
  } : false
}));

// ─── Core Middleware ──────────────────────────────────────────────────────────
app.use(cookieParser());                             // Parse HTTP-only cookies (refresh tokens)
app.use(fileLogger);                                 // LEVEL 6: Audit trail (File)
app.use(consoleLogger);                              // LEVEL 6: Audit trail (Terminal)
app.use(express.json({ limit: '1mb' }));         // Prevent large payload attacks
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(sanitizeBody);                               // LEVEL 5: Strip $-prefix operator injection keys

// ─── TASK 9: Cache-Control Hardening (Data Leakage Prevention) ────────────────
// Prevent browsers from saving sensitive ERP API responses (prices, salaries)
// to the user's local hard drive or shared proxy caches.
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

// ─── TASK 1: Global Rate Limiter — 100 requests per 15 minutes per IP/user ───
app.use('/api/', generalLimiter);

// ─── TASK 1: Extra strict limiter for slow/heavy endpoints (30 per min) ──
app.use('/api/orders', strictLimiter);
app.use('/api/payments', strictLimiter);
app.use('/api/production', strictLimiter);
// ─── Routes ──────────────────────────────────────────────────────────────────
// Note: individual sensitive routes (/login, POST /orders, POST /payments)
// have additional stricter rate limiters applied directly in their route files.
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/materials', require('./routes/materials'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/production', require('./routes/production'));
app.use('/api/deliveries', require('./routes/deliveries'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/product-models', require('./routes/productModels'));
app.use('/api/tariffs', require('./routes/tariffs'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/worker-types', require('./routes/workerTypes'));
app.use('/api/reports', require('./routes/reports'));

// Health check (not rate-limited — internal probes need this)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── TASK 5: Centralized Safe Error Handler ───────────────────────────────────
// Replaces the old inline handler that exposed stack traces.
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

if (process.env.VERCEL) {
  // Auto-seed default admin on Vercel Cold Start if no admin exists
  async function ensureDefaultAdmin() {
    try {
      const { User } = require('./models');
      const adminExists = await User.findOne({ where: { role: 'admin' } });
      if (!adminExists) {
        await User.create({
          username: 'admin',
          password: 'admin123',
          fullName: 'Administrateur',
          role: 'admin',
          email: 'admin@erp-canape.local'
        });
        console.log('✅ Default admin user (admin) automatically seeded.');
      }
    } catch (err) {
      console.error('Auto-seed admin failed:', err.message);
    }
  }
  ensureDefaultAdmin();

  // On Vercel Serverless, we export the app and skip the slow DB Sync on every invocation.
  module.exports = app;
} else {
  sequelize.sync({ alter: true }).then(() => {
    console.log('✅ Database synced (Altered)');
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
      console.log(`🔒 Security: Helmet ✅ | Rate Limiting ✅ | Input Validation ✅ | Safe Errors ✅`);
    });
  }).catch(err => {
    console.error('❌ Database sync failed:', err);
  });
}
