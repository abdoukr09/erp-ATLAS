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
const REFRESH_TOKEN_DAYS = 7;            // Refresh token validity in days

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

// ─── Native (Capacitor) client support ─────────────────────────────────────
// The Android app runs on origin https://localhost, so the refresh cookie is a
// third-party cookie and gets dropped. Native clients identify themselves with
// `X-Client: capacitor`; they receive the refresh token in the response body and
// send it back in `X-Refresh-Token`. Browsers keep using the HTTP-only cookie.

/** True when the caller is the Capacitor app rather than a browser */
function isNativeClient(req) {
  return req.headers['x-client'] === 'capacitor';
}

/** Read the refresh token from the cookie (web) or the header (native) */
function readRefreshToken(req) {
  return req.cookies?.refreshToken || req.headers['x-refresh-token'] || null;
}

// ─── POST /api/auth/login ─────────────────────────────────────────────────
// Rate limited (5/min) + Joi validated
router.post('/login', loginLimiter, validate(schemas.login), async (req, res, next) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ where: { username } });

    // Unknown user — don't reveal whether username exists
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // ── Brute-force lockout check ────────────────────────────────────────
    const MAX_ATTEMPTS = 10;
    const LOCK_MINUTES = 15;

    if (user.lockedUntil && new Date() < new Date(user.lockedUntil)) {
      const minutesLeft = Math.ceil((new Date(user.lockedUntil) - new Date()) / 60000);
      return res.status(429).json({
        error: `Account temporarily locked. Try again in ${minutesLeft} minute(s).`,
      });
    }

    if (!user.active) {
      return res.status(401).json({ error: 'Account is deactivated.' });
    }

    const isValid = await user.validatePassword(password);
    if (!isValid) {
      // Increment failure counter
      const newAttempts = (user.failedLoginAttempts || 0) + 1;
      const updates = { failedLoginAttempts: newAttempts };

      if (newAttempts >= MAX_ATTEMPTS) {
        const lockedUntil = new Date();
        lockedUntil.setMinutes(lockedUntil.getMinutes() + LOCK_MINUTES);
        updates.lockedUntil = lockedUntil;
      }

      await user.update(updates);
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // ── SUCCESS: reset lockout counters & update last login ───────────────
    await user.update({ failedLoginAttempts: 0, lockedUntil: null, lastLogin: new Date() });

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
      sameSite: 'lax',
      maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
    });

    const payload = {
      token: accessToken, // Backward compatibility for the React frontend
      accessToken,
      expiresIn: ACCESS_TOKEN_EXPIRY,
      user: user.toJSON(),
    };

    // Native clients can't keep the cookie — hand them the token to store themselves
    if (isNativeClient(req)) {
      payload.refreshToken = rawRefreshToken;
    }

    res.json(payload);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/refresh ──────────────────────────────────────────────
// Issues a new access token using the HTTP-only refresh token cookie.
// The old refresh token is rotated (deleted and replaced) on each use.
router.post('/refresh', async (req, res, next) => {
  try {
    const rawToken = readRefreshToken(req);
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
      sameSite: 'lax',
      maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
    });

    // Issue fresh access token
    const accessToken = signAccessToken(user);
    const payload = { accessToken, expiresIn: ACCESS_TOKEN_EXPIRY };

    // Rotation happened above — the native app must persist the replacement,
    // otherwise its stored token is now dead and the session breaks.
    if (isNativeClient(req)) {
      payload.refreshToken = newRawToken;
    }

    res.json(payload);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/logout ───────────────────────────────────────────────
// Deletes the refresh token from DB → instantly revokes the session.
// Works even if the access token is still valid (will expire in ≤15min).
router.post('/logout', async (req, res, next) => {
  try {
    const rawToken = readRefreshToken(req);
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
