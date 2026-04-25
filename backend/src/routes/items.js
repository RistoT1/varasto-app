'use strict';

/**
 * Tavarat (items) endpoints
 *
 * GET  /api/items               list all, with filters & pagination
 * GET  /api/items/search        full-text search by name / tunniste
 * GET  /api/items/:id           single item with full location chain
 * POST /api/items               create
 * PUT  /api/items/:id           full replace
 * PATCH /api/items/:id          partial update
 * DELETE /api/items/:id         delete
 */

const router = require('express').Router();
const { body, query, param } = require('express-validator');
const db = require('../config/db');
const { validate } = require('../middleware/validate');
const { authenticate, requireAdmin } = require('../middleware/auth');

// ─── helpers ────────────────────────────────────────────────────────────────

const BASE_SELECT = `
  SELECT
    t.ID,
    t.Nimi,
    t.Huom,
    t.Tunniste,
    t.Palautus_vaaditaan,
    tr.ID   AS tuoteryhma_id,
    tr.Tuoteryhma,
    h.ID    AS hylly_id,
    h.Hylly_numero,
    k.ID    AS kaappi_id,
    k.Kaappi_numero,
    v.ID    AS varasto_id,
    v.Varasto_nimi,
    la.ID   AS laatikko_id,
    la.Laatikko_nimi
  FROM tavarat t
  LEFT JOIN tuoteryhmat  tr ON tr.ID = t.Tuoteryhma_id
  LEFT JOIN hyllyt        h ON h.ID  = t.Hylly_id
  LEFT JOIN kaapit        k ON k.ID  = h.Kaappi_id
  LEFT JOIN varastot      v ON v.ID  = k.Varasto_id
  LEFT JOIN laatikot     la ON la.ID = t.Laatikko_id
`;

function buildItem(row) {
  return {
    id: row.ID,
    name: row.Nimi,
    note: row.Huom,
    tag: row.Tunniste,
    returnRequired: !!row.Palautus_vaaditaan,
    productGroup: row.tuoteryhma_id
      ? { id: row.tuoteryhma_id, name: row.Tuoteryhma }
      : null,
    shelf: row.hylly_id
      ? {
        id: row.hylly_id,
        number: row.Hylly_numero,
        cabinet: row.kaappi_id
          ? {
            id: row.kaappi_id,
            number: row.Kaappi_numero,
            warehouse: row.varasto_id
              ? { id: row.varasto_id, name: row.Varasto_nimi }
              : null,
          }
          : null,
      }
      : null,
    box: row.laatikko_id
      ? { id: row.laatikko_id, name: row.Laatikko_nimi }
      : null,
  };
}

// ─── GET /api/items ──────────────────────────────────────────────────────────
router.get(
  '/',
  authenticate,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
    query('tuoteryhma_id').optional().isInt().toInt(),
    query('varasto_id').optional().isInt().toInt(),
    query('kaappi_id').optional().isInt().toInt(),
    query('hylly_id').optional().isInt().toInt(),
    query('sort').optional().isIn(['id', 'name', 'tuoteryhma']),
    query('order').optional().isIn(['asc', 'desc']),
  ],
  validate,
  async (req, res) => {
    try {
      const page = req.query.page || 1;
      const limit = req.query.limit || 50;
      const offset = (page - 1) * limit;

      const where = [];
      const params = [];

      if (req.query.tuoteryhma_id) { where.push('t.Tuoteryhma_id = ?'); params.push(req.query.tuoteryhma_id); }
      if (req.query.varasto_id) { where.push('v.ID = ?'); params.push(req.query.varasto_id); }
      if (req.query.kaappi_id) { where.push('k.ID = ?'); params.push(req.query.kaappi_id); }
      if (req.query.hylly_id) { where.push('h.ID = ?'); params.push(req.query.hylly_id); }

      const SORT_MAP = { id: 't.ID', name: 't.Nimi', tuoteryhma: 'tr.Tuoteryhma' };
      const sortCol = SORT_MAP[req.query.sort] || 't.Nimi';
      const order = (req.query.order || 'asc').toUpperCase();

      const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

      const [[{ total }]] = await db.execute(
        `SELECT COUNT(*) AS total FROM tavarat t
          LEFT JOIN tuoteryhmat tr ON tr.ID = t.Tuoteryhma_id
          LEFT JOIN hyllyt       h ON h.ID  = t.Hylly_id
          LEFT JOIN kaapit       k ON k.ID  = h.Kaappi_id
          LEFT JOIN varastot     v ON v.ID  = k.Varasto_id
          ${whereClause}`,
        params,
      );

      const [rows] = await db.execute(
        `${BASE_SELECT} ${whereClause} ORDER BY ${sortCol} ${order} LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      );

      res.json({
        data: rows.map(buildItem),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ─── GET /api/items/search ───────────────────────────────────────────────────
router.get(
  '/search',
  authenticate,
  [
    query('q').trim().notEmpty().withMessage('q is required'),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
  ],
  validate,
  async (req, res) => {
    try {
      const q = `%${req.query.q}%`;
      const page = req.query.page || 1;
      const limit = req.query.limit || 50;
      const offset = (page - 1) * limit;

      const [[{ total }]] = await db.execute(
        `SELECT COUNT(*) AS total FROM tavarat t
          LEFT JOIN tuoteryhmat tr ON tr.ID = t.Tuoteryhma_id
          WHERE t.Nimi LIKE ? OR t.Tunniste LIKE ? OR t.Huom LIKE ?
             OR tr.Tuoteryhma LIKE ?`,
        [q, q, q, q],
      );

      const [rows] = await db.execute(
        `${BASE_SELECT}
          WHERE t.Nimi LIKE ? OR t.Tunniste LIKE ? OR t.Huom LIKE ?
             OR tr.Tuoteryhma LIKE ?
          ORDER BY t.Nimi ASC LIMIT ? OFFSET ?`,
        [q, q, q, q, limit, offset],
      );

      res.json({
        data: rows.map(buildItem),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ─── GET /api/items/:id ──────────────────────────────────────────────────────
router.get(
  '/:id',
  authenticate,
  [param('id').isInt({ min: 1 }).toInt()],
  validate,
  async (req, res) => {
    try {
      const [rows] = await db.execute(`${BASE_SELECT} WHERE t.ID = ?`, [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'Item not found' });
      res.json(buildItem(rows[0]));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ─── POST /api/items ─────────────────────────────────────────────────────────
router.post(
  '/',
  authenticate,
  requireAdmin,
  [
    body('name').trim().notEmpty().withMessage('name is required').isLength({ max: 128 }),
    body('tag').optional({ nullable: true }).isString().isLength({ max: 16 }),
    body('note').optional({ nullable: true }).isString().isLength({ max: 255 }),
    body('tuoteryhma_id').optional({ nullable: true }).isInt().toInt(),
    body('hylly_id').optional({ nullable: true }).isInt().toInt(),
    body('laatikko_id').optional({ nullable: true }).isInt().toInt(),
    body('return_required').optional().isBoolean().toBoolean(),
  ],
  validate,
  async (req, res) => {
    try {
      const {
        name,
        note = '',
        tag = null,
        tuoteryhma_id = null,
        hylly_id = null,
        laatikko_id = null,
        return_required = false,
      } = req.body;

      const [result] = await db.execute(
        `INSERT INTO tavarat (Nimi, Huom, Tunniste, Tuoteryhma_id, Hylly_id, Laatikko_id, Palautus_vaaditaan)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [name, note, tag, tuoteryhma_id, hylly_id, laatikko_id, return_required ? 1 : 0],
      );

      const [rows] = await db.execute(`${BASE_SELECT} WHERE t.ID = ?`, [result.insertId]);
      res.status(201).json(buildItem(rows[0]));
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'An item with that name or tag already exists' });
      }
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ─── PUT /api/items/:id ──────────────────────────────────────────────────────
router.put(
  '/:id',
  authenticate,
  requireAdmin,
  [
    param('id').isInt({ min: 1 }).toInt(),
    body('name').trim().notEmpty().withMessage('name is required').isLength({ max: 128 }),
    body('note').optional().isString().isLength({ max: 255 }),
    body('tag').optional({ nullable: true }).isString().isLength({ max: 16 }),
    body('tuoteryhma_id').optional({ nullable: true }).isInt().toInt(),
    body('hylly_id').optional({ nullable: true }).isInt().toInt(),
    body('laatikko_id').optional({ nullable: true }).isInt().toInt(),
    body('return_required').optional().isBoolean().toBoolean(),
  ],
  validate,
  async (req, res) => {
    try {
      const {
        name,
        note = '',
        tag = null,
        tuoteryhma_id = null,
        hylly_id = null,
        laatikko_id = null,
        return_required = false,
      } = req.body;

      const [result] = await db.execute(
        `UPDATE tavarat SET Nimi=?, Huom=?, Tunniste=?, Tuoteryhma_id=?, Hylly_id=?, Laatikko_id=?, Palautus_vaaditaan=?
          WHERE ID=?`,
        [name, note, tag, tuoteryhma_id, hylly_id, laatikko_id, return_required ? 1 : 0, req.params.id],
      );

      if (result.affectedRows === 0) return res.status(404).json({ error: 'Item not found' });

      const [rows] = await db.execute(`${BASE_SELECT} WHERE t.ID = ?`, [req.params.id]);
      res.json(buildItem(rows[0]));
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'An item with that name or tag already exists' });
      }
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ─── PATCH /api/items/:id ────────────────────────────────────────────────────
router.patch(
  '/:id',
  authenticate,
  requireAdmin,
  [
    param('id').isInt({ min: 1 }).toInt(),
    body('name').optional().trim().notEmpty().isLength({ max: 128 }),
    body('note').optional().isString().isLength({ max: 255 }),
    body('tag').optional({ nullable: true }).isString().isLength({ max: 16 }),
    body('tuoteryhma_id').optional({ nullable: true }).isInt().toInt(),
    body('hylly_id').optional({ nullable: true }).isInt().toInt(),
    body('laatikko_id').optional({ nullable: true }).isInt().toInt(),
    body('return_required').optional().isBoolean().toBoolean(),
  ],
  validate,
  async (req, res) => {
    try {
      const FIELD_MAP = {
        name: 'Nimi',
        note: 'Huom',
        tag: 'Tunniste',
        tuoteryhma_id: 'Tuoteryhma_id',
        hylly_id: 'Hylly_id',
        laatikko_id: 'Laatikko_id',
        return_required: 'Palautus_vaaditaan',
      };

      const sets = [];
      const params = [];

      for (const [key, col] of Object.entries(FIELD_MAP)) {
        if (Object.prototype.hasOwnProperty.call(req.body, key)) {
          let val = req.body[key] ?? null;
          if (key === 'return_required') val = val ? 1 : 0;
          sets.push(`${col} = ?`);
          params.push(val);
        }
      }

      if (sets.length === 0) {
        return res.status(422).json({ error: 'No updatable fields provided' });
      }

      params.push(req.params.id);
      const [result] = await db.execute(
        `UPDATE tavarat SET ${sets.join(', ')} WHERE ID = ?`,
        params,
      );

      if (result.affectedRows === 0) return res.status(404).json({ error: 'Item not found' });

      const [rows] = await db.execute(`${BASE_SELECT} WHERE t.ID = ?`, [req.params.id]);
      res.json(buildItem(rows[0]));
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'An item with that name or tag already exists' });
      }
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ─── DELETE /api/items/:id ───────────────────────────────────────────────────
router.delete(
  '/:id',
  authenticate,
  requireAdmin,
  [param('id').isInt({ min: 1 }).toInt()],
  validate,
  async (req, res) => {
    try {
      const [result] = await db.execute('DELETE FROM tavarat WHERE ID = ?', [req.params.id]);
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Item not found' });
      res.status(204).end();
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

module.exports = router;