'use strict';

/**
 * Varastot (warehouses) endpoints
 *
 * GET  /api/warehouses             list all
 * GET  /api/warehouses/search      search by name
 * GET  /api/warehouses/:id         single warehouse
 * GET  /api/warehouses/:id/cabinets  cabinets in this warehouse
 * GET  /api/warehouses/:id/items    all items in this warehouse
 * POST /api/warehouses             create  (admin)
 * PUT  /api/warehouses/:id         update  (admin)
 * DELETE /api/warehouses/:id       delete  (admin)
 */

const router = require('express').Router();
const { body, query, param } = require('express-validator');
const db     = require('../config/db');
const { validate }      = require('../middleware/validate');
const { authenticate, requireAdmin } = require('../middleware/auth');

// GET /api/warehouses
router.get('/', authenticate, async (_req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT v.ID, v.Varasto_nimi,
              COUNT(DISTINCT k.ID) AS cabinet_count,
              COUNT(DISTINCT h.ID) AS shelf_count
         FROM varastot v
         LEFT JOIN kaapit k ON k.Varasto_id = v.ID
         LEFT JOIN hyllyt h ON h.Kaappi_id  = k.ID
         GROUP BY v.ID
         ORDER BY v.Varasto_nimi`,
    );
    res.json(rows.map(r => ({ id: r.ID, name: r.Varasto_nimi, cabinetCount: r.cabinet_count, shelfCount: r.shelf_count })));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/warehouses/search
router.get(
  '/search',
  authenticate,
  [query('q').trim().notEmpty().withMessage('q is required')],
  validate,
  async (req, res) => {
    try {
      const [rows] = await db.execute(
        'SELECT ID, Varasto_nimi FROM varastot WHERE Varasto_nimi LIKE ? ORDER BY Varasto_nimi',
        [`%${req.query.q}%`],
      );
      res.json(rows.map(r => ({ id: r.ID, name: r.Varasto_nimi })));
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
  },
);

// GET /api/warehouses/:id
router.get(
  '/:id',
  authenticate,
  [param('id').isInt({ min: 1 }).toInt()],
  validate,
  async (req, res) => {
    try {
      const [rows] = await db.execute('SELECT ID, Varasto_nimi FROM varastot WHERE ID = ?', [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'Warehouse not found' });
      const r = rows[0];
      res.json({ id: r.ID, name: r.Varasto_nimi });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
  },
);

// GET /api/warehouses/:id/cabinets
router.get(
  '/:id/cabinets',
  authenticate,
  [param('id').isInt({ min: 1 }).toInt()],
  validate,
  async (req, res) => {
    try {
      const [rows] = await db.execute(
        `SELECT k.ID, k.Kaappi_numero, COUNT(h.ID) AS shelf_count
           FROM kaapit k
           LEFT JOIN hyllyt h ON h.Kaappi_id = k.ID
          WHERE k.Varasto_id = ?
          GROUP BY k.ID
          ORDER BY k.Kaappi_numero`,
        [req.params.id],
      );
      res.json(rows.map(r => ({ id: r.ID, number: r.Kaappi_numero, shelfCount: r.shelf_count })));
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
  },
);

// GET /api/warehouses/:id/items
router.get(
  '/:id/items',
  authenticate,
  [
    param('id').isInt({ min: 1 }).toInt(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
  ],
  validate,
  async (req, res) => {
    try {
      const page   = req.query.page  || 1;
      const limit  = req.query.limit || 50;
      const offset = (page - 1) * limit;

      const [[{ total }]] = await db.execute(
        `SELECT COUNT(*) AS total FROM tavarat t
           JOIN hyllyt h ON h.ID = t.Hylly_id
           JOIN kaapit  k ON k.ID = h.Kaappi_id
          WHERE k.Varasto_id = ?`,
        [req.params.id],
      );

      const [rows] = await db.execute(
        `SELECT t.ID, t.Nimi, t.Huom, t.Tunniste,
                h.Hylly_numero, k.Kaappi_numero
           FROM tavarat t
           JOIN hyllyt h ON h.ID = t.Hylly_id
           JOIN kaapit  k ON k.ID = h.Kaappi_id
          WHERE k.Varasto_id = ?
          ORDER BY t.Nimi LIMIT ? OFFSET ?`,
        [req.params.id, limit, offset],
      );

      res.json({
        data: rows.map(r => ({ id: r.ID, name: r.Nimi, note: r.Huom, tag: r.Tunniste,
          shelf: r.Hylly_numero, cabinet: r.Kaappi_numero })),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
  },
);

// POST /api/warehouses  (admin)
router.post(
  '/',
  authenticate,
  requireAdmin,
  [body('name').trim().notEmpty().withMessage('name is required').isLength({ max: 64 })],
  validate,
  async (req, res) => {
    try {
      const [result] = await db.execute('INSERT INTO varastot (Varasto_nimi) VALUES (?)', [req.body.name]);
      res.status(201).json({ id: result.insertId, name: req.body.name });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
  },
);

// PUT /api/warehouses/:id  (admin)
router.put(
  '/:id',
  authenticate,
  requireAdmin,
  [
    param('id').isInt({ min: 1 }).toInt(),
    body('name').trim().notEmpty().withMessage('name is required').isLength({ max: 64 }),
  ],
  validate,
  async (req, res) => {
    try {
      const [result] = await db.execute('UPDATE varastot SET Varasto_nimi=? WHERE ID=?', [req.body.name, req.params.id]);
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Warehouse not found' });
      res.json({ id: req.params.id, name: req.body.name });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
  },
);

// DELETE /api/warehouses/:id  (admin)
router.delete(
  '/:id',
  authenticate,
  requireAdmin,
  [param('id').isInt({ min: 1 }).toInt()],
  validate,
  async (req, res) => {
    try {
      const [result] = await db.execute('DELETE FROM varastot WHERE ID=?', [req.params.id]);
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Warehouse not found' });
      res.status(204).end();
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
  },
);

module.exports = router;
