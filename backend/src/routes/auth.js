const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const authenticate = require('../middleware/authenticate');

const router = express.Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function databaseReady(req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: { message: 'Database is unavailable' } });
  }
  if (!req.app.locals.config.jwtSecret) {
    return res.status(503).json({ error: { message: 'Authentication is not configured' } });
  }
  next();
}

function createToken(user, config) {
  return jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

router.post('/register', databaseReady, async (req, res, next) => {
  try {
    const { displayName, email, password } = req.body || {};
    if (typeof displayName !== 'string' || displayName.trim().length < 2 || displayName.trim().length > 40) {
      return res.status(400).json({ error: { message: 'Display name must be 2 to 40 characters' } });
    }
    if (typeof email !== 'string' || !emailPattern.test(email.trim()) || email.trim().length > 254) {
      return res.status(400).json({ error: { message: 'A valid email address is required' } });
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
      return res.status(400).json({ error: { message: 'Password must be 8 to 72 characters' } });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (await User.exists({ email: normalizedEmail })) {
      return res.status(409).json({ error: { message: 'An account with that email already exists' } });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ displayName: displayName.trim(), email: normalizedEmail, passwordHash });
    res.status(201).json({
      token: createToken(user, req.app.locals.config),
      user: { id: user.id, displayName: user.displayName, email: user.email }
    });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: { message: 'An account with that email already exists' } });
    next(error);
  }
});

router.post('/login', databaseReady, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: { message: 'Email and password are required' } });
    }
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash');
    const valid = user && await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: { message: 'Invalid email or password' } });

    res.json({
      token: createToken(user, req.app.locals.config),
      user: { id: user.id, displayName: user.displayName, email: user.email }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/me', (req, res, next) => authenticate(req.app.locals.config)(req, res, next), async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: { message: 'Database is unavailable' } });
    }
    const user = await User.findById(req.userId);
    if (!user) return res.status(401).json({ error: { message: 'Account no longer exists' } });
    res.json({ user: { id: user.id, displayName: user.displayName, email: user.email } });
  } catch (error) {
    next(error);
  }
});

module.exports = { router, authenticate };
