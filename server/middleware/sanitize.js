/**
 * LEVEL 5: Payload Sanitization — NoSQL / Sequelize Operator Injection Guard
 *
 * Sequelize ORM uses parameterized queries by default, but when user-controlled
 * keys like "$where", "$gt", "$or" reach findAll({ where: req.body }) patterns,
 * they can be exploited to bypass filters or extract data.
 *
 * This middleware recursively walks req.body and removes any key that starts
 * with "$" before the request reaches any controller.
 *
 * Applied globally in index.js — zero config needed per route.
 */

const DANGEROUS_PREFIXES = ['$'];

/**
 * Recursively removes keys starting with dangerous prefixes from an object.
 * Handles nested objects and arrays.
 */
function sanitize(obj) {
  if (Array.isArray(obj)) {
    return obj.map(sanitize);
  }

  if (obj !== null && typeof obj === 'object') {
    const cleaned = {};
    for (const key of Object.keys(obj)) {
      const isDangerous = DANGEROUS_PREFIXES.some(prefix => key.startsWith(prefix));
      if (!isDangerous) {
        cleaned[key] = sanitize(obj[key]);
      }
      // Silently drop dangerous keys — no error, no leak
    }
    return cleaned;
  }

  return obj; // primitives pass through unchanged
}

const sanitizeBody = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitize(req.body);
  }
  // Also sanitize query params (e.g. /api/orders?$where=...)
  if (req.query && typeof req.query === 'object') {
    req.query = sanitize(req.query);
  }
  next();
};

module.exports = sanitizeBody;
