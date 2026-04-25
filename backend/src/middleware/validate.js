'use strict';

const { validationResult } = require('express-validator');

/**
 * Run after express-validator chains.
 * Returns 422 with structured error list if any check failed.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  next();
}

module.exports = { validate };
