const jwt = require('jsonwebtoken');
const { User } = require('../models');

// Verify JWT token
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await User.findByPk(decoded.id);
    if (!user || !user.active) {
      return res.status(401).json({ error: 'Invalid or inactive user.' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token.' });
  }
};

// ─── LEVEL 8: Hierarchical Role-Based Access Control (RBAC) ────────────────
// Defines which lower-level permissions are automatically granted to upper roles.
// Prevents bugs where an 'admin' is locked out of a basic 'sales' route
// just because 'admin' wasn't explicitly added to the route's array.
const roleHierarchy = {
  admin:      ['admin', 'gerant', 'sales', 'production', 'delivery'], // God mode
  gerant:     ['gerant', 'sales', 'production', 'delivery'],          // Manager mode
  sales:      ['sales'],
  production: ['production'],
  delivery:   ['delivery'],
};

const authorize = (...requiredRoles) => {
  return (req, res, next) => {
    const userRole = req.user.role;
    
    // 1. Direct match
    if (requiredRoles.includes(userRole)) {
      return next();
    }
    
    // 2. Hierarchical match
    const userGrants = roleHierarchy[userRole] || [];
    const hasPermission = requiredRoles.some(role => userGrants.includes(role));
    
    if (hasPermission) {
      return next();
    }

    return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
  };
};

module.exports = { authenticate, authorize };
