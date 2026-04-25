const { validationResult } = require('express-validator');

/**
 * Wraps an async route handler and forwards errors to Express error middleware.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Validates express-validator results and returns 422 on failure.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors.array(),
    });
  }
  next();
};

/**
 * Central error handler — must be registered last.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  const isDev  = process.env.NODE_ENV !== 'production';

  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} → ${status}`, err.message);

  res.status(status).json({
    status:  'error',
    message: isDev ? err.message : 'Internal server error',
    ...(isDev && { stack: err.stack }),
  });
};

/**
 * 404 handler — register after all routes.
 */
const notFound = (req, res) => {
  res.status(404).json({
    status:  'error',
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
};

module.exports = { asyncHandler, validate, errorHandler, notFound };
