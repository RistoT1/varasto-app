'use strict';

const express = require('express');
const { body, query, param } = require('express-validator');
const db      = require('../config/db');
const { validate }      = require('../middleware/validate');
const { authenticate, requireAdmin } = require('../middleware/auth');

// ─── CABINETS ────────────────────────────────────────────────────────────────

const cabinets = express.Router();

cabinets.get(
  '/',
  authenticate,
  [
    query('varasto_id').optional().isInt().toInt(),
    query('mapped').optional().isBoolean().toBoolean(),
  ],
  validate,
  async (req, res) => {
    try {
      const conditions = [];
      const params     = [];

      if (req.query.varasto_id) {
        conditions.push('k.Varasto_id = ?');
        params.push(req.query.varasto_id);
      }
      if (req.query.mapped === true) {
        conditions.push('k.map_x IS NOT NULL AND k.map_y IS NOT NULL');
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const [rows] = await db.execute(
        `SELECT k.ID, k.Kaappi_numero, k.Varasto_id, k.map_x, k.map_y, k.color,
                v.Varasto_nimi, COUNT(h.ID) AS shelf_count
           FROM kaapit k
           LEFT JOIN varastot v ON v.ID = k.Varasto_id
           LEFT JOIN hyllyt   h ON h.Kaappi_id = k.ID
           ${where}
           GROUP BY k.ID, k.Kaappi_numero, k.Varasto_id, k.map_x, k.map_y, k.color, v.Varasto_nimi
           ORDER BY v.Varasto_nimi, k.Kaappi_numero`,
        params,
      );
      res.json(rows.map(r => ({
        id:           r.ID,
        number:       r.Kaappi_numero,
        map_x:        r.map_x,
        map_y:        r.map_y,
        color:        r.color || '#2563eb',
        shelfCount:   r.shelf_count,
        varasto_nimi: r.Varasto_nimi,
        warehouse:    { id: r.Varasto_id, name: r.Varasto_nimi },
      })));
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
  },
);

cabinets.get(
  '/search',
  authenticate,
  [query('q').trim().notEmpty()],
  validate,
  async (req, res) => {
    try {
      const [rows] = await db.execute(
        `SELECT k.ID, k.Kaappi_numero, k.map_x, k.map_y, k.color,
                v.ID AS varasto_id, v.Varasto_nimi
           FROM kaapit k
           LEFT JOIN varastot v ON v.ID = k.Varasto_id
          WHERE k.Kaappi_numero LIKE ?
          ORDER BY v.Varasto_nimi, k.Kaappi_numero`,
        [`%${req.query.q}%`],
      );
      res.json(rows.map(r => ({
        id:       r.ID,
        number:   r.Kaappi_numero,
        map_x:    r.map_x,
        map_y:    r.map_y,
        color:    r.color || '#2563eb',
        warehouse: { id: r.varasto_id, name: r.Varasto_nimi },
      })));
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
  },
);

cabinets.get(
  '/:id',
  authenticate,
  [param('id').isInt({ min: 1 }).toInt()],
  validate,
  async (req, res) => {
    try {
      const [rows] = await db.execute(
        `SELECT k.ID, k.Kaappi_numero, k.map_x, k.map_y, k.color,
                v.ID AS varasto_id, v.Varasto_nimi
           FROM kaapit k LEFT JOIN varastot v ON v.ID = k.Varasto_id WHERE k.ID = ?`,
        [req.params.id],
      );
      if (!rows.length) return res.status(404).json({ error: 'Cabinet not found' });
      const r = rows[0];
      res.json({
        id:       r.ID,
        number:   r.Kaappi_numero,
        map_x:    r.map_x,
        map_y:    r.map_y,
        color:    r.color || '#2563eb',
        warehouse: { id: r.varasto_id, name: r.Varasto_nimi },
      });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
  },
);

cabinets.get(
  '/:id/shelves',
  authenticate,
  [param('id').isInt({ min: 1 }).toInt()],
  validate,
  async (req, res) => {
    try {
      const [rows] = await db.execute(
        `SELECT h.ID, h.Hylly_numero, COUNT(t.ID) AS item_count
           FROM hyllyt h
           LEFT JOIN tavarat t ON t.Hylly_id = h.ID
          WHERE h.Kaappi_id = ?
          GROUP BY h.ID ORDER BY h.Hylly_numero`,
        [req.params.id],
      );
      res.json(rows.map(r => ({ id: r.ID, number: r.Hylly_numero, itemCount: r.item_count })));
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
  },
);

cabinets.post(
  '/',
  authenticate, requireAdmin,
  [
    body('number').trim().notEmpty().isLength({ max: 8 }),
    body('varasto_id').isInt({ min: 1 }).toInt(),
    body('map_x').optional({ nullable: true }).isInt().toInt(),
    body('map_y').optional({ nullable: true }).isInt().toInt(),
  ],
  validate,
  async (req, res) => {
    try {
      const { number, varasto_id, map_x = null, map_y = null } = req.body;
      const [result] = await db.execute(
        'INSERT INTO kaapit (Kaappi_numero, Varasto_id, map_x, map_y) VALUES (?, ?, ?, ?)',
        [number, varasto_id, map_x, map_y],
      );
      res.status(201).json({ id: result.insertId, number, varasto_id, map_x, map_y });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
  },
);

cabinets.put(
  '/:id',
  authenticate, requireAdmin,
  [
    param('id').isInt({ min: 1 }).toInt(),
    body('number').trim().notEmpty().isLength({ max: 8 }),
    body('varasto_id').isInt({ min: 1 }).toInt(),
    body('map_x').optional({ nullable: true }).isInt().toInt(),
    body('map_y').optional({ nullable: true }).isInt().toInt(),
  ],
  validate,
  async (req, res) => {
    try {
      const { number, varasto_id, map_x = null, map_y = null } = req.body;
      const [result] = await db.execute(
        'UPDATE kaapit SET Kaappi_numero=?, Varasto_id=?, map_x=?, map_y=? WHERE ID=?',
        [number, varasto_id, map_x, map_y, req.params.id],
      );
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Cabinet not found' });
      res.json({ id: req.params.id, number, varasto_id, map_x, map_y });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
  },
);

// PATCH /:id/position — map drag + color saves
// FIX: color lisätty — luetaan suoraan req.body:stä ilman express-validator-ketjua
// jottei se tipu sanitoinnissa
cabinets.patch(
  '/:id/position',
  authenticate, requireAdmin,
  [
    param('id').isInt({ min: 1 }).toInt(),
    body('map_x').optional({ nullable: true }).isInt().toInt(),
    body('map_y').optional({ nullable: true }).isInt().toInt(),
    // color EI ole tässä — luetaan ja validoidaan manuaalisesti alla
  ],
  validate,
  async (req, res) => {
    try {
      const map_x = req.body.map_x ?? null;
      const map_y = req.body.map_y ?? null;
      const color = req.body.color; // undefined jos ei lähetetty

      // Manuaalinen värivalidointi
      if (color !== undefined && color !== null) {
        if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
          return res.status(422).json({ error: 'Invalid color, must be #rrggbb' });
        }
      }

      // Dynaaminen UPDATE — color vain jos lähetetty
      const kentat = ['map_x = ?', 'map_y = ?'];
      const arvot  = [map_x, map_y];

      if (color !== undefined) {
        kentat.push('color = ?');
        arvot.push(color);
      }
      arvot.push(req.params.id);

      const [result] = await db.execute(
        `UPDATE kaapit SET ${kentat.join(', ')} WHERE ID = ?`,
        arvot,
      );
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Cabinet not found' });

      // Haetaan päivitetty rivi — ei konstruoida vastausta käsin
      const [[row]] = await db.execute(
        'SELECT ID AS id, map_x, map_y, color FROM kaapit WHERE ID = ?',
        [req.params.id],
      );

      res.json({ id: row.id, map_x: row.map_x, map_y: row.map_y, color: row.color });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
  },
);

cabinets.delete(
  '/:id',
  authenticate, requireAdmin,
  [param('id').isInt({ min: 1 }).toInt()],
  validate,
  async (req, res) => {
    try {
      const [result] = await db.execute('DELETE FROM kaapit WHERE ID=?', [req.params.id]);
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Cabinet not found' });
      res.status(204).end();
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
  },
);

// ─── SHELVES ─────────────────────────────────────────────────────────────────

const shelves = express.Router();

shelves.get(
  '/',
  authenticate,
  [query('kaappi_id').optional().isInt().toInt()],
  validate,
  async (req, res) => {
    try {
      const where  = req.query.kaappi_id ? 'WHERE h.Kaappi_id = ?' : '';
      const params = req.query.kaappi_id ? [req.query.kaappi_id] : [];
      const [rows] = await db.execute(
        `SELECT h.ID, h.Hylly_numero, k.ID AS kaappi_id, k.Kaappi_numero, v.Varasto_nimi,
                COUNT(t.ID) AS item_count
           FROM hyllyt h
           LEFT JOIN kaapit   k ON k.ID = h.Kaappi_id
           LEFT JOIN varastot v ON v.ID = k.Varasto_id
           LEFT JOIN tavarat  t ON t.Hylly_id = h.ID
           ${where}
           GROUP BY h.ID
           ORDER BY v.Varasto_nimi, k.Kaappi_numero, h.Hylly_numero`,
        params,
      );
      res.json(rows.map(r => ({
        id:        r.ID,
        number:    r.Hylly_numero,
        itemCount: r.item_count,
        cabinet:   { id: r.kaappi_id, number: r.Kaappi_numero, warehouse: r.Varasto_nimi },
      })));
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
  },
);

shelves.get(
  '/search',
  authenticate,
  [query('q').trim().notEmpty()],
  validate,
  async (req, res) => {
    try {
      const [rows] = await db.execute(
        `SELECT h.ID, h.Hylly_numero, k.Kaappi_numero, v.Varasto_nimi
           FROM hyllyt h
           LEFT JOIN kaapit   k ON k.ID = h.Kaappi_id
           LEFT JOIN varastot v ON v.ID = k.Varasto_id
          WHERE h.Hylly_numero LIKE ?
          ORDER BY v.Varasto_nimi, k.Kaappi_numero, h.Hylly_numero`,
        [`%${req.query.q}%`],
      );
      res.json(rows.map(r => ({ id: r.ID, number: r.Hylly_numero, cabinet: r.Kaappi_numero, warehouse: r.Varasto_nimi })));
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
  },
);

shelves.get(
  '/:id',
  authenticate,
  [param('id').isInt({ min: 1 }).toInt()],
  validate,
  async (req, res) => {
    try {
      const [rows] = await db.execute(
        `SELECT h.ID, h.Hylly_numero, k.ID AS kaappi_id, k.Kaappi_numero, v.ID AS varasto_id, v.Varasto_nimi
           FROM hyllyt h
           LEFT JOIN kaapit   k ON k.ID = h.Kaappi_id
           LEFT JOIN varastot v ON v.ID = k.Varasto_id
          WHERE h.ID = ?`,
        [req.params.id],
      );
      if (!rows.length) return res.status(404).json({ error: 'Shelf not found' });
      const r = rows[0];
      res.json({
        id: r.ID, number: r.Hylly_numero,
        cabinet: { id: r.kaappi_id, number: r.Kaappi_numero, warehouse: { id: r.varasto_id, name: r.Varasto_nimi } },
      });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
  },
);

shelves.get(
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
        'SELECT COUNT(*) AS total FROM tavarat WHERE Hylly_id = ?', [req.params.id],
      );
      const [rows] = await db.execute(
        `SELECT t.ID, t.Nimi, t.Huom, t.Tunniste,
                tr.Tuoteryhma, la.Laatikko_nimi
           FROM tavarat t
           LEFT JOIN tuoteryhmat tr ON tr.ID = t.Tuoteryhma_id
           LEFT JOIN laatikot    la ON la.ID  = t.Laatikko_id
          WHERE t.Hylly_id = ?
          ORDER BY t.Nimi LIMIT ? OFFSET ?`,
        [req.params.id, limit, offset],
      );
      res.json({
        data: rows.map(r => ({ id: r.ID, name: r.Nimi, note: r.Huom, tag: r.Tunniste, productGroup: r.Tuoteryhma, box: r.Laatikko_nimi })),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
  },
);

shelves.post(
  '/',
  authenticate, requireAdmin,
  [
    body('number').trim().notEmpty().isLength({ max: 8 }),
    body('kaappi_id').isInt({ min: 1 }).toInt(),
  ],
  validate,
  async (req, res) => {
    try {
      const [result] = await db.execute(
        'INSERT INTO hyllyt (Hylly_numero, Kaappi_id) VALUES (?, ?)',
        [req.body.number, req.body.kaappi_id],
      );
      res.status(201).json({ id: result.insertId, number: req.body.number, kaappi_id: req.body.kaappi_id });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
  },
);

shelves.put(
  '/:id',
  authenticate, requireAdmin,
  [
    param('id').isInt({ min: 1 }).toInt(),
    body('number').trim().notEmpty().isLength({ max: 8 }),
    body('kaappi_id').isInt({ min: 1 }).toInt(),
  ],
  validate,
  async (req, res) => {
    try {
      const [result] = await db.execute(
        'UPDATE hyllyt SET Hylly_numero=?, Kaappi_id=? WHERE ID=?',
        [req.body.number, req.body.kaappi_id, req.params.id],
      );
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Shelf not found' });
      res.json({ id: req.params.id, number: req.body.number, kaappi_id: req.body.kaappi_id });
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
  },
);

shelves.delete(
  '/:id',
  authenticate, requireAdmin,
  [param('id').isInt({ min: 1 }).toInt()],
  validate,
  async (req, res) => {
    try {
      const [result] = await db.execute('DELETE FROM hyllyt WHERE ID=?', [req.params.id]);
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Shelf not found' });
      res.status(204).end();
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
  },
);

module.exports = { cabinets, shelves };