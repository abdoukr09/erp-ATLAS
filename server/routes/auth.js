const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User, RefreshToken } = require('../models');
const { authenticate } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimiter');
const { validate, schemas } = require('../middleware/validate');
const router = express.Router();

// ─── Token config ──────────────────────────────────────────────────────────
const ACCESS_TOKEN_EXPIRY = '15m';       // Short-lived access token
const REFRESH_TOKEN_DAYS  = 7;            // Refresh token validity in days

/** Generate a secure random opaque refresh token */
function generateRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

/** Issue a new access token */
function signAccessToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

// ─── POST /api/auth/login ─────────────────────────────────────────────────
// Rate limited (5/min) + Joi validated
router.post('/login', loginLimiter, validate(schemas.login), async (req, res, next) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ where: { username } });
    if (!user || !user.active) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const isValid = await user.validatePassword(password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // Issue short-lived access token
    const accessToken = signAccessToken(user);

    // Issue long-lived refresh token (stored in DB for revocability)
    const rawRefreshToken = generateRefreshToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_DAYS);

    await RefreshToken.create({
      token: rawRefreshToken,
      userId: user.id,
      expiresAt,
    });

    // Send refresh token as HTTP-only cookie (not accessible by JS)
    res.cookie('refreshToken', rawRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
      sameSite: 'strict',
      maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
    });

    res.json({
      accessToken,
      expiresIn: ACCESS_TOKEN_EXPIRY,
      user: user.toJSON(),
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/refresh ──────────────────────────────────────────────
// Issues a new access token using the HTTP-only refresh token cookie.
// The old refresh token is rotated (deleted and replaced) on each use.
router.post('/refresh', async (req, res, next) => {
  try {
    const rawToken = req.cookies?.refreshToken;
    if (!rawToken) {
      return res.status(401).json({ error: 'Refresh token missing.' });
    }

    // Find the token in DB
    const stored = await RefreshToken.findOne({ where: { token: rawToken } });
    if (!stored) {
      // Token not in DB → possible token theft — clear the cookie
      res.clearCookie('refreshToken');
      return res.status(401).json({ error: 'Invalid refresh token.' });
    }

    // Check expiry
    if (new Date() > new Date(stored.expiresAt)) {
      await stored.destroy();
      res.clearCookie('refreshToken');
      return res.status(401).json({ error: 'Refresh token expired. Please log in again.' });
    }

    // Load user
    const user = await User.findByPk(stored.userId);
    if (!user || !user.active) {
      await stored.destroy();
      res.clearCookie('refreshToken');
      return res.status(401).json({ error: 'User not found or inactive.' });
    }

    // ── Token Rotation: delete old, issue new ──────────────────────────────
    await stored.destroy();

    const newRawToken = generateRefreshToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_DAYS);
    await RefreshToken.create({ token: newRawToken, userId: user.id, expiresAt });

    res.cookie('refreshToken', newRawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
    });

    // Issue fresh access token
    const accessToken = signAccessToken(user);
    res.json({ accessToken, expiresIn: ACCESS_TOKEN_EXPIRY });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/logout ───────────────────────────────────────────────
// Deletes the refresh token from DB → instantly revokes the session.
// Works even if the access token is still valid (will expire in ≤15min).
router.post('/logout', async (req, res, next) => {
  try {
    const rawToken = req.cookies?.refreshToken;
    if (rawToken) {
      await RefreshToken.destroy({ where: { token: rawToken } });
    }
    res.clearCookie('refreshToken');
    res.json({ message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  res.json({ user: req.user.toJSON() });
});

module.exports = router;
