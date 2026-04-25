'use strict';

const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const db = require('../config/db');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiters');

// POST /api/auth/login
router.post(
  '/login',
  authLimiter,
  [
    body('username').trim().notEmpty().withMessage('username is required'),
    body('password').notEmpty().withMessage('password is required'),
  ],
  validate,
  async (req, res) => {
    try {
      const { username, password } = req.body;

      const [rows] = await db.execute(
        `SELECT kt.ID, kt.Nimi, kt.Salasana, kt.Aktiivinen,
                kl.Kayttolupa
           FROM kayttaja_tiedot kt
           LEFT JOIN kayttoluvat kl ON kl.ID = kt.Kayttolupa_id
          WHERE kt.Nimi = ?`,
        [username],
      );

      const user = rows[0];
      if (!user || !user.Aktiivinen) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const match = await bcrypt.compare(password, user.Salasana);
      if (!match) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const payload = { id: user.ID, username: user.Nimi, kayttolupa: user.Kayttolupa };
      const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '8h',
      });

      res.cookie('token', token, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 8 * 60 * 60 * 1000
      });

      // Token poistettu vastauksesta
      res.json({ user: { id: user.ID, username: user.Nimi, permission: user.Kayttolupa } });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// POST /api/auth/logout  ← lisää tämä
router.post('/logout', (req, res) => {
  res.clearCookie('token')
  res.json({ ok: true })
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router; 