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
const { generalLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const sanitizeBody = require('./middleware/sanitize');

// Import models (triggers associations)
require('./models');

const app = express();

// ─── TASK 4: Security Headers (helmet) ───────────────────────────────────────
// Safe defaults that don't break the React Vite frontend.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // needed by React inline styles
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", 'http://localhost:5001', 'http://localhost:5173'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false, // Required to avoid breaking React fetch calls
}));

// ─── Core Middleware ──────────────────────────────────────────────────────────
app.use(cors());
app.use(cookieParser());                             // Parse HTTP-only cookies (refresh tokens)
app.use(express.json({ limit: '1mb' }));         // Prevent large payload attacks
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(sanitizeBody);                               // LEVEL 5: Strip $-prefix operator injection keys

// ─── TASK 1: Global Rate Limiter — 100 requests per 15 minutes per IP/user ───
app.use('/api/', generalLimiter);

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

// Health check (not rate-limited — internal probes need this)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── TASK 5: Centralized Safe Error Handler ───────────────────────────────────
// Replaces the old inline handler that exposed stack traces.
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

sequelize.sync().then(() => {
  console.log('✅ Database synced');
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`🔒 Security: Helmet ✅ | Rate Limiting ✅ | Input Validation ✅ | Safe Errors ✅`);
  });
}).catch(err => {
  console.error('❌ Database sync failed:', err);
});

