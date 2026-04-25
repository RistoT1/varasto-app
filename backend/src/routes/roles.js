'use strict';

/**
 * Kayttoluvat (permission roles) endpoints
 *
 * GET  /api/roles          list all roles
 * GET  /api/roles/:id      single role
 * POST /api/roles          create  (admin)
 * PUT  /api/roles/:id      update  (admin)
 * DELETE /api/roles/:id    delete  (admin)
 */

const router = require('express').Router();
const { body, param } = require('express-validator');
const db = require('../config/db');
const { validate }      = require('../middleware/validate');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/', authenticate, async (_req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT kl.ID, kl.Kayttolupa, COUNT(kt.ID) AS user_count
        FROM kayttoluvat kl
        LEFT JOIN kayttaja_tiedot kt ON kt.Kayttolupa_id = kl.ID
        GROUP BY kl.ID ORDER BY kl.Kayttolupa
    `);
    res.json(rows.map(r => ({ id: r.ID, name: r.Kayttolupa, userCount: r.user_count })));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

router.get(
  '/:id',
  authenticate,
  [param('id').isInt({ min: 1 }).toInt()],
  validate,
  async (req, res) => {
    try {
      const [rows] = await db.execute('SELECT ID, Kayttolupa FROM kayttoluvat WHERE ID = ?', [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'Role not found' });
      res.json({ id: rows[0].ID, name: rows[0].Kayttolupa });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
  },
);

router.post(
  '/',
  authenticate, requireAdmin,
  [body('name').trim().notEmpty().isLength({ max: 128 })],
  validate,
  async (req, res) => {
    try {
      const [result] = await db.execute('INSERT INTO kayttoluvat (Kayttolupa) VALUES (?)', [req.body.name]);
      res.status(201).json({ id: result.insertId, name: req.body.name });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Role already exists' });
      console.error(err); res.status(500).json({ error: 'Internal server error' });
    }
  },
);

router.put(
  '/:id',
  authenticate, requireAdmin,
  [param('id').isInt({ min: 1 }).toInt(), body('name').trim().notEmpty().isLength({ max: 128 })],
  validate,
  async (req, res) => {
    try {
      const [result] = await db.execute('UPDATE kayttoluvat SET Kayttolupa=? WHERE ID=?', [req.body.name, req.params.id]);
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Role not found' });
      res.json({ id: req.params.id, name: req.body.name });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
  },
);

router.delete(
  '/:id',
  authenticate, requireAdmin,
  [param('id').isInt({ min: 1 }).toInt()],
  validate,
  async (req, res) => {
    try {
      const [result] = await db.execute('DELETE FROM kayttoluvat WHERE ID=?', [req.params.id]);
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Role not found' });
      res.status(204).end();
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
  },
);

module.exports = router;
