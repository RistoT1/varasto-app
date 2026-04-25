'use strict';

/**
 * Kayttaja_tiedot (users) endpoints
 *
 * GET  /api/users              list (admin only)
 * GET  /api/users/:id          single user (admin or self)
 * POST /api/users              create user (admin)
 * PATCH /api/users/:id/password change password (self or admin)
 * PATCH /api/users/:id/status  activate / deactivate (admin)
 * DELETE /api/users/:id        delete (admin)
 */

const router = require('express').Router();
const bcrypt = require('bcrypt');
const { body, param } = require('express-validator');
const db = require('../config/db');
const { validate }      = require('../middleware/validate');
const { authenticate, requireAdmin } = require('../middleware/auth');

const SALT_ROUNDS = 12;

function buildUser(r) {
  return {
    id:         r.ID,
    username:   r.Nimi,
    active:     Boolean(r.Aktiivinen),
    permission: r.Kayttolupa || null,
    permissionId: r.Kayttolupa_id,
  };
}

// GET /api/users
router.get('/', authenticate, requireAdmin, async (_req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT kt.ID, kt.Nimi, kt.Aktiivinen, kt.Kayttolupa_id, kl.Kayttolupa
         FROM kayttaja_tiedot kt
         LEFT JOIN kayttoluvat kl ON kl.ID = kt.Kayttolupa_id
         ORDER BY kt.Nimi`,
    );
    res.json(rows.map(buildUser));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/users/:id
router.get(
  '/:id',
  authenticate,
  [param('id').isInt({ min: 1 }).toInt()],
  validate,
  async (req, res) => {
    // Users may only view their own record unless they are admin
    if (req.user.kayttolupa !== 'Admin' && req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    try {
      const [rows] = await db.execute(
        `SELECT kt.ID, kt.Nimi, kt.Aktiivinen, kt.Kayttolupa_id, kl.Kayttolupa
           FROM kayttaja_tiedot kt
           LEFT JOIN kayttoluvat kl ON kl.ID = kt.Kayttolupa_id
          WHERE kt.ID = ?`,
        [req.params.id],
      );
      if (!rows.length) return res.status(404).json({ error: 'User not found' });
      res.json(buildUser(rows[0]));
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
  },
);

// POST /api/users  (admin)
router.post(
  '/',
  authenticate, requireAdmin,
  [
    body('username').trim().notEmpty().isLength({ min: 3, max: 64 }),
    body('password').notEmpty().isLength({ min: 6 }).withMessage('password min 6 characters'),
    body('kayttolupa_id').optional({ nullable: true }).isInt().toInt(),
  ],
  validate,
  async (req, res) => {
    try {
      const hash = await bcrypt.hash(req.body.password, SALT_ROUNDS);
      const [result] = await db.execute(
        'INSERT INTO kayttaja_tiedot (Nimi, Salasana, Kayttolupa_id) VALUES (?, ?, ?)',
        [req.body.username, hash, req.body.kayttolupa_id ?? null],
      );
      res.status(201).json({ id: result.insertId, username: req.body.username });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Username already taken' });
      console.error(err); res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// PATCH /api/users/:id/password
router.patch(
  '/:id/password',
  authenticate,
  [
    param('id').isInt({ min: 1 }).toInt(),
    body('password').notEmpty().isLength({ min: 6 }),
  ],
  validate,
  async (req, res) => {
    if (req.user.kayttolupa !== 'Admin' && req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    try {
      const hash = await bcrypt.hash(req.body.password, SALT_ROUNDS);
      const [result] = await db.execute(
        'UPDATE kayttaja_tiedot SET Salasana=? WHERE ID=?', [hash, req.params.id],
      );
      if (result.affectedRows === 0) return res.status(404).json({ error: 'User not found' });
      res.json({ message: 'Password updated' });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
  },
);

// PATCH /api/users/:id/status  (admin)
router.patch(
  '/:id/status',
  authenticate, requireAdmin,
  [
    param('id').isInt({ min: 1 }).toInt(),
    body('active').isBoolean().withMessage('active must be true or false'),
  ],
  validate,
  async (req, res) => {
    try {
      const [result] = await db.execute(
        'UPDATE kayttaja_tiedot SET Aktiivinen=? WHERE ID=?',
        [req.body.active ? 1 : 0, req.params.id],
      );
      if (result.affectedRows === 0) return res.status(404).json({ error: 'User not found' });
      res.json({ id: req.params.id, active: Boolean(req.body.active) });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
  },
);

// DELETE /api/users/:id  (admin)
router.delete(
  '/:id',
  authenticate, requireAdmin,
  [param('id').isInt({ min: 1 }).toInt()],
  validate,
  async (req, res) => {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }
    try {
      const [result] = await db.execute('DELETE FROM kayttaja_tiedot WHERE ID=?', [req.params.id]);
      if (result.affectedRows === 0) return res.status(404).json({ error: 'User not found' });
      res.status(204).end();
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
  },
);

module.exports = router;
