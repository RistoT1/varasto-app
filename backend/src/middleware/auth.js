'use strict';

const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const token = req.cookies?.token

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.clearCookie('token')
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.kayttolupa !== 'Admin') {
    return res.status(403).json({ error: 'Admin permission required' });
  }
  next();
}

module.exports = { authenticate, requireAdmin };