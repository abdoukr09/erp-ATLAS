/**
 * TASK 2: Input Validation & Sanitization (using Joi)
 * Validates and sanitizes request bodies for all critical endpoints.
 * Runs BEFORE controller logic. Does NOT touch business logic.
 *
 * Usage in routes:
 *   router.post('/', validate(schemas.createOrder), controllerFn)
 */
const Joi = require('joi');

// ─── Helper: strip basic HTML tags to prevent XSS in strings ───────────────
const sanitizeString = (val) => (typeof val === 'string' ? val.trim().replace(/<[^>]*>/g, '') : val);

// ─── Common reusable string field ──────────────────────────────────────────
const safeStr = (max = 100) =>
  Joi.string().max(max).custom((val, helpers) => {
    const clean = sanitizeString(val);
    if (clean !== val) return helpers.error('string.xss');
    return clean;
  });

// ─── Route Schemas ─────────────────────────────────────────────────────────
const schemas = {

  // POST /api/auth/login
  login: Joi.object({
    username: safeStr(50).required(),
    password: Joi.string().min(4).max(128).required(),
  }),

  // POST /api/customers
  createCustomer: Joi.object({
    name: safeStr(100).required(),
    phone: safeStr(20).optional().allow('', null),
    address: safeStr(200).optional().allow('', null),
  }),

  // POST /api/orders
  createOrder: Joi.object({
    customerId: Joi.number().integer().positive().required(),
    items: Joi.array().items(Joi.object({
      sofaModel: safeStr(100).required(),
      quantity: Joi.number().integer().min(1).max(999).required(),
      unitPrice: Joi.number().min(0).required(),
      discountPercentage: Joi.number().min(0).max(100).default(0),
      fabric: safeStr(100).optional().allow('', null),
      color: safeStr(50).optional().allow('', null),
    })).min(1).required(),
    salesmen: Joi.array().items(Joi.object({
      salesmanId: Joi.number().integer().positive().required(),
      splitPercentage: Joi.number().min(0).max(100).optional(),
    })).optional(),
    deliveryAddress: safeStr(200).optional().allow('', null),
    notes: safeStr(500).optional().allow('', null),
    orderDate: Joi.date().iso().optional().allow('', null),
    discountPercentage: Joi.number().min(0).max(100).empty('').optional(),
    totalPrice: Joi.number().min(0).empty('').optional(),
    advancePayment: Joi.number().min(0).empty('').optional(),
    paymentMethod: safeStr(20).optional().allow('', null),
    useStock: Joi.boolean().empty('').optional(),
    salesmanId: Joi.number().integer().positive().empty('').optional(),
    status: Joi.string().valid('pending', 'in_production', 'ready', 'delivered', 'cancelled').optional(),
  }).options({ allowUnknown: true }),

  // POST /api/payments
  createPayment: Joi.object({
    orderId: Joi.number().integer().positive().required(),
    amount: Joi.number().positive().required(),
    method: Joi.string().valid('cash', 'card', 'transfer', 'cheque').optional(),
    paymentDate: Joi.date().iso().optional().allow('', null),
    notes: safeStr(300).optional().allow('', null),
    type: Joi.string().valid('advance', 'other').optional(), // 'final' is blocked by business logic
  }),

  // PUT /api/payments/:id
  updatePayment: Joi.object({
    amount: Joi.number().positive().optional(),
    method: Joi.string().valid('cash', 'card', 'transfer', 'cheque').optional(),
    paymentDate: Joi.date().iso().optional().allow('', null),
    notes: safeStr(300).optional().allow('', null),
    type: Joi.string().valid('advance', 'other').optional(),
  }),

  // PUT /api/production/:id
  updateProduction: Joi.object({
    status: Joi.string().valid('pending', 'in_progress', 'completed').optional(),
    workers: Joi.array().items(Joi.object({
      workerId: Joi.number().integer().positive().required(),
      commissionType: Joi.string().valid('percentage', 'fixed').required(),
      commissionValue: Joi.number().min(0).required(),
    })).optional(),
  }).options({ allowUnknown: true }), // production has extra fields, be permissive here

  // POST /api/materials
  createMaterial: Joi.object({
    name: safeStr(100).required(),
    stock: Joi.number().min(0).required(),
    minStock: Joi.number().min(0).optional(),
    unit: safeStr(30).optional().allow('', null),
  }),
};

// ─── Validation Middleware Factory ─────────────────────────────────────────
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const data = source === 'body' ? req.body : source === 'params' ? req.params : req.query;
    const { error, value } = schema.validate(data, {
      abortEarly: false,       // Report all errors, not just the first
      allowUnknown: false,     // Reject unexpected fields by default
      stripUnknown: false,
    });

    if (error) {
      const details = error.details.map(d => d.message.replace(/['"]/g, ''));
      return res.status(400).json({ error: 'Invalid input', details });
    }

    // Replace req.body with validated/sanitized value
    if (source === 'body') req.body = value;
    next();
  };
};

module.exports = { validate, schemas };
