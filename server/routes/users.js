const express = require('express');
const { User } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

// GET /api/users - list all users (admin only)
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const users = await User.findAll({ order: [['createdAt', 'DESC']] });

    // Check for active sessions using RefreshToken table
    const { RefreshToken } = require('../models');
    const now = new Date();
    const activeTokens = await RefreshToken.findAll({
      where: {
        expiresAt: { [require('sequelize').Op.gt]: now }
      }
    });
    const activeUserIds = new Set(activeTokens.map(t => t.userId));

    const usersWithOnlineStatus = users.map(user => {
      const u = user.toJSON();
      u.isOnline = activeUserIds.has(u.id);
      return u;
    });

    res.json(usersWithOnlineStatus);
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/users - create user (admin only)
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { username, password, fullName, role, email } = req.body;

    if (!username || !password || !fullName) {
      return res.status(400).json({ error: 'Username, password, and full name are required.' });
    }

    const existing = await User.findOne({ where: { username } });
    if (existing) {
      return res.status(400).json({ error: 'Username already exists.' });
    }

    const user = await User.create({ username, password, fullName, role, email });
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /api/users/:id - update user (admin only)
router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const { username, password, fullName, role, email, active } = req.body;

    // Safety checks for active status
    if (active === false) {
      if (user.id === req.user.id) {
        return res.status(400).json({ error: 'Cannot deactivate your own account.' });
      }
      if (user.role === 'admin') {
        const { Op } = require('sequelize');
        const activeAdmins = await User.count({
          where: { role: 'admin', active: true, id: { [Op.ne]: user.id } }
        });
        if (activeAdmins === 0) {
          return res.status(400).json({ error: 'Cannot deactivate the last active administrator.' });
        }
      }
    }

    if (username) user.username = username;
    if (password) user.password = password;
    if (fullName) user.fullName = fullName;
    if (role) user.role = role;
    if (email !== undefined) user.email = email;
    if (active !== undefined) user.active = active;

    await user.save();
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/users/:id - delete user (admin only)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (user.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account.' });
    }

    await user.destroy();
    res.json({ message: 'User deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
