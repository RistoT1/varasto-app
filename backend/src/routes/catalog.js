'use strict';

/**
 * Tuoteryhmat (product groups) + Laatikot (boxes)
 *
 * GET  /api/product-groups                list all
 * GET  /api/product-groups/search         search by name
 * GET  /api/product-groups/:id/items      items in this group
 * POST /api/product-groups                create (admin)
 * PUT  /api/product-groups/:id            update (admin)
 * DELETE /api/product-groups/:id          delete (admin)
 *
 * GET  /api/boxes                         list all
 * GET  /api/boxes/search                  search by name
 * GET  /api/boxes/:id/items               items in this box
 * POST /api/boxes                         create (admin)
 * PUT  /api/boxes/:id                     update (admin)
 * DELETE /api/boxes/:id                   delete (admin)
 */

const express = require('express');
const { body, query, param } = require('express-validator');
const db = require('../config/db');
const { validate }      = require('../middleware/validate');
const { authenticate, requireAdmin } = require('../middleware/auth');

// ─── PRODUCT GROUPS ──────────────────────────────────────────────────────────

const productGroups = express.Router();

productGroups.get('/', authenticate, async (_req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT tr.ID, tr.Tuoteryhma, COUNT(t.ID) AS item_count
         FROM tuoteryhmat tr
         LEFT JOIN tavarat t ON t.Tuoteryhma_id = tr.ID
         GROUP BY tr.ID ORDER BY tr.Tuoteryhma`,
    );
    res.json(rows.map(r => ({ id: r.ID, name: r.Tuoteryhma, itemCount: r.item_count })));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

productGroups.get(
  '/search',
  authenticate,
  [query('q').trim().notEmpty()],
  validate,
  async (req, res) => {
    try {
      const [rows] = await db.execute(
        'SELECT ID, Tuoteryhma FROM tuoteryhmat WHERE Tuoteryhma LIKE ? ORDER BY Tuoteryhma',
        [`%${req.query.q}%`],
      );
      res.json(rows.map(r => ({ id: r.ID, name: r.Tuoteryhma })));
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
  },
);

productGroups.get(
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
        'SELECT COUNT(*) AS total FROM tavarat WHERE Tuoteryhma_id = ?', [req.params.id],
      );
      const [rows] = await db.execute(
        `SELECT t.ID, t.Nimi, t.Huom, t.Tunniste
           FROM tavarat t
          WHERE t.Tuoteryhma_id = ?
          ORDER BY t.Nimi LIMIT ? OFFSET ?`,
        [req.params.id, limit, offset],
      );
      res.json({
        data: rows.map(r => ({ id: r.ID, name: r.Nimi, note: r.Huom, tag: r.Tunniste })),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
  },
);

productGroups.post(
  '/',
  authenticate, requireAdmin,
  [body('name').trim().notEmpty().isLength({ max: 64 })],
  validate,
  async (req, res) => {
    try {
      const [result] = await db.execute('INSERT INTO tuoteryhmat (Tuoteryhma) VALUES (?)', [req.body.name]);
      res.status(201).json({ id: result.insertId, name: req.body.name });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Product group already exists' });
      console.error(err); res.status(500).json({ error: 'Internal server error' });
    }
  },
);

productGroups.put(
  '/:id',
  authenticate, requireAdmin,
  [param('id').isInt({ min: 1 }).toInt(), body('name').trim().notEmpty().isLength({ max: 64 })],
  validate,
  async (req, res) => {
    try {
      const [result] = await db.execute('UPDATE tuoteryhmat SET Tuoteryhma=? WHERE ID=?', [req.body.name, req.params.id]);
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Product group not found' });
      res.json({ id: req.params.id, name: req.body.name });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
  },
);

productGroups.delete(
  '/:id',
  authenticate, requireAdmin,
  [param('id').isInt({ min: 1 }).toInt()],
  validate,
  async (req, res) => {
    try {
      const [result] = await db.execute('DELETE FROM tuoteryhmat WHERE ID=?', [req.params.id]);
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Product group not found' });
      res.status(204).end();
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
  },
);

// ─── BOXES ───────────────────────────────────────────────────────────────────

const boxes = express.Router();

boxes.get('/', authenticate, async (_req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT la.ID, la.Laatikko_nimi, COUNT(t.ID) AS item_count
         FROM laatikot la
         LEFT JOIN tavarat t ON t.Laatikko_id = la.ID
         GROUP BY la.ID ORDER BY la.Laatikko_nimi`,
    );
    res.json(rows.map(r => ({ id: r.ID, name: r.Laatikko_nimi, itemCount: r.item_count })));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

boxes.get(
  '/search',
  authenticate,
  [query('q').trim().notEmpty()],
  validate,
  async (req, res) => {
    try {
      const [rows] = await db.execute(
        'SELECT ID, Laatikko_nimi FROM laatikot WHERE Laatikko_nimi LIKE ? ORDER BY Laatikko_nimi',
        [`%${req.query.q}%`],
      );
      res.json(rows.map(r => ({ id: r.ID, name: r.Laatikko_nimi })));
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
  },
);

boxes.get(
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
        'SELECT COUNT(*) AS total FROM tavarat WHERE Laatikko_id = ?', [req.params.id],
      );
      const [rows] = await db.execute(
        `SELECT t.ID, t.Nimi, t.Huom, t.Tunniste, h.Hylly_numero, k.Kaappi_numero, v.Varasto_nimi
           FROM tavarat t
           LEFT JOIN hyllyt h ON h.ID = t.Hylly_id
           LEFT JOIN kaapit  k ON k.ID = h.Kaappi_id
           LEFT JOIN varastot v ON v.ID = k.Varasto_id
          WHERE t.Laatikko_id = ?
          ORDER BY t.Nimi LIMIT ? OFFSET ?`,
        [req.params.id, limit, offset],
      );
      res.json({
        data: rows.map(r => ({ id: r.ID, name: r.Nimi, note: r.Huom, tag: r.Tunniste,
          shelf: r.Hylly_numero, cabinet: r.Kaappi_numero, warehouse: r.Varasto_nimi })),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
  },
);

boxes.post(
  '/',
  authenticate, requireAdmin,
  [body('name').trim().notEmpty().isLength({ max: 128 })],
  validate,
  async (req, res) => {
    try {
      const [result] = await db.execute('INSERT INTO laatikot (Laatikko_nimi) VALUES (?)', [req.body.name]);
      res.status(201).json({ id: result.insertId, name: req.body.name });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Box name already exists' });
      console.error(err); res.status(500).json({ error: 'Internal server error' });
    }
  },
);

boxes.put(
  '/:id',
  authenticate, requireAdmin,
  [param('id').isInt({ min: 1 }).toInt(), body('name').trim().notEmpty().isLength({ max: 128 })],
  validate,
  async (req, res) => {
    try {
      const [result] = await db.execute('UPDATE laatikot SET Laatikko_nimi=? WHERE ID=?', [req.body.name, req.params.id]);
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Box not found' });
      res.json({ id: req.params.id, name: req.body.name });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
  },
);

boxes.delete(
  '/:id',
  authenticate, requireAdmin,
  [param('id').isInt({ min: 1 }).toInt()],
  validate,
  async (req, res) => {
    try {
      const [result] = await db.execute('DELETE FROM laatikot WHERE ID=?', [req.params.id]);
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Box not found' });
      res.status(204).end();
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
  },
);

module.exports = { productGroups, boxes };
