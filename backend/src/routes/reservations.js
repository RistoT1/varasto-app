'use strict';

const router = require('express').Router();
const { body, query, param } = require('express-validator');
const db = require('../config/db');
const { validate } = require('../middleware/validate');
const { authenticate, requireAdmin } = require('../middleware/auth');

const BASE_SELECT = `
  SELECT
    va.ID,
    va.Varaus_alku,
    va.Varaus_loppu,
    va.Tila,
    kt.ID   AS user_id,
    kt.Nimi AS user_name,
    t.ID    AS item_id,
    t.Nimi  AS item_name,
    t.Tunniste AS item_tag,
    h.Hylly_numero,
    k.Kaappi_numero,
    v.Varasto_nimi
  FROM varaukset va
  LEFT JOIN kayttaja_tiedot kt ON kt.ID = va.Kayttaja_id
  LEFT JOIN tavarat          t  ON t.ID  = va.Tavara_id
  LEFT JOIN hyllyt           h  ON h.ID  = t.Hylly_id
  LEFT JOIN kaapit           k  ON k.ID  = h.Kaappi_id
  LEFT JOIN varastot         v  ON v.ID  = k.Varasto_id
`;

function isActive(r) {
  if (r.Tila !== 1) return false
  return true
}

function buildReservation(r) {
  return {
    id: r.ID,
    startedAt: r.Varaus_alku,
    returnedAt: r.Varaus_loppu,
    tila: r.Tila,
    active: isActive(r),
    user: r.user_id ? { id: r.user_id, name: r.user_name } : null,
    item: r.item_id ? {
      id: r.item_id,
      name: r.item_name,
      tag: r.item_tag,
      shelf: r.Hylly_numero,
      cabinet: r.Kaappi_numero,
      warehouse: r.Varasto_nimi,
    } : null,
  };
}

// GET /api/reservations
router.get(
  '/',
  authenticate,
  [
    query('active').optional().isBoolean().toBoolean(),
    query('user_id').optional().isInt({ min: 1 }).toInt(),
    query('item_id').optional().isInt({ min: 1 }).toInt(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
  ],
  validate,
  async (req, res) => {
    try {
      const page = req.query.page || 1;
      const limit = req.query.limit || 50;
      const offset = (page - 1) * limit;
      const where = [];
      const params = [];
      const isAdmin = req.user.kayttolupa === 'Admin';

      // Non-admins are always scoped to themselves, ignoring any user_id param
      if (!isAdmin) {
        where.push('va.Kayttaja_id = ?');
        params.push(req.user.id);
      } else if (req.query.user_id) {
        // Admins can filter by a specific user
        where.push('va.Kayttaja_id = ?');
        params.push(req.query.user_id);
      }

      const active = req.query.active;
      if (active === 'true' || active === true) where.push('va.Tila = 1');
      if (active === 'false' || active === false) where.push('(va.Tila = 0 OR (va.Varaus_loppu IS NOT NULL AND va.Varaus_loppu <= NOW()))');
      
      if (req.query.item_id) {
        where.push('va.Tavara_id = ?');
        params.push(req.query.item_id);
      }
      console.log(where);
      const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

      const [[{ total }]] = await db.execute(
        `SELECT COUNT(*) AS total FROM varaukset va ${whereClause}`, params,
      );
      const [rows] = await db.execute(
        `${BASE_SELECT} ${whereClause} ORDER BY va.Varaus_alku DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      );
      res.json({
        data: rows.map(buildReservation),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
  },
);

// GET /api/reservations/:id
router.get(
  '/:id',
  authenticate,
  [param('id').isInt({ min: 1 }).toInt()],
  validate,
  async (req, res) => {
    try {
      const [rows] = await db.execute(`${BASE_SELECT} WHERE va.ID = ?`, [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'Reservation not found' });
      res.json(buildReservation(rows[0]));
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
  },
);

// POST /api/reservations
router.post(
  '/',
  authenticate,
  [
    body('item_id').isInt({ min: 1 }).toInt().withMessage('item_id is required'),
    body('user_id').optional({ nullable: true }).isInt().toInt(),
    body('Varaus_alku').optional({ nullable: true }).isISO8601(),
    body('Varaus_loppu').optional({ nullable: true }).isISO8601(),
  ],
  validate,
  async (req, res) => {
    try {
      const userId = req.body.user_id ?? req.user.id;
      const alkuDate = req.body.Varaus_alku ? new Date(req.body.Varaus_alku) : new Date();
      const loppuDate = req.body.Varaus_loppu ? new Date(req.body.Varaus_loppu) : null;

      const [result] = await db.execute(
        'INSERT INTO varaukset (Kayttaja_id, Tavara_id, Varaus_alku, Varaus_loppu, Tila) VALUES (?, ?, ?, ?, 1)',
        [userId, req.body.item_id, alkuDate, loppuDate],
      );
      const [rows] = await db.execute(`${BASE_SELECT} WHERE va.ID = ?`, [result.insertId]);
      res.status(201).json(buildReservation(rows[0]));
    } catch (err) {
      if (err.code === 'ER_NO_REFERENCED_ROW_2')
        return res.status(422).json({ error: 'item_id or user_id does not exist' });
      console.error(err); res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// PATCH /api/reservations/:id/return  — manual return, sets Tila=0
router.patch(
  '/:id/return',
  authenticate,
  [param('id').isInt({ min: 1 }).toInt()],
  validate,
  async (req, res) => {
    try {
      const [result] = await db.execute(
        'UPDATE varaukset SET Tila = 0, Varaus_loppu = COALESCE(Varaus_loppu, NOW()) WHERE ID = ? AND Tila = 1',
        [req.params.id],
      );
      if (result.affectedRows === 0)
        return res.status(404).json({ error: 'Active reservation not found' });
      const [rows] = await db.execute(`${BASE_SELECT} WHERE va.ID = ?`, [req.params.id]);
      res.json(buildReservation(rows[0]));
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
  },
);

// DELETE /api/reservations/:id (admin)
router.delete(
  '/:id',
  authenticate,
  requireAdmin,
  [param('id').isInt({ min: 1 }).toInt()],
  validate,
  async (req, res) => {
    try {
      const [result] = await db.execute('DELETE FROM varaukset WHERE ID=?', [req.params.id]);
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Reservation not found' });
      res.status(204).end();
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
  },
);

module.exports = router;