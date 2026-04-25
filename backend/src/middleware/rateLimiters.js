const rateLimit = require('express-rate-limit');

// ── Rate limiting ─────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || (process.env.NODE_ENV === 'development' ? 1000 : 500),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: 'Liian monta kirjautumis yritystä' },
});

module.exports = {
  globalLimiter,
  authLimiter,
};