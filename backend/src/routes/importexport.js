'use strict';

/**
 * Import / Export endpoints
 *
 * GET  /api/export/items.csv          Export all items as CSV
 * GET  /api/export/items.json         Export all items as JSON
 * GET  /api/export/warehouses.json    Export full warehouse tree
 * GET  /api/export/reservations.csv   Export reservations as CSV
 *
 * POST /api/import/items/csv          Bulk import items from CSV upload
 * POST /api/import/items/json         Bulk import items from JSON body
 */

const router  = require('express').Router();
const multer  = require('multer');
const { parse }     = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const db = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) return cb(null, true);
    cb(new Error('Only CSV files are accepted'));
  },
});

// ─── helpers ────────────────────────────────────────────────────────────────

const ITEM_QUERY = `
  SELECT
    t.ID         AS id,
    t.Nimi       AS name,
    t.Huom       AS note,
    t.Tunniste   AS tag,
    tr.Tuoteryhma AS product_group,
    h.Hylly_numero AS shelf,
    k.Kaappi_numero AS cabinet,
    v.Varasto_nimi   AS warehouse,
    la.Laatikko_nimi AS box
  FROM tavarat t
  LEFT JOIN tuoteryhmat  tr ON tr.ID = t.Tuoteryhma_id
  LEFT JOIN hyllyt        h ON h.ID  = t.Hylly_id
  LEFT JOIN kaapit        k ON k.ID  = h.Kaappi_id
  LEFT JOIN varastot      v ON v.ID  = k.Varasto_id
  LEFT JOIN laatikot     la ON la.ID = t.Laatikko_id
  ORDER BY t.Nimi
`;

const CSV_COLUMNS = ['id','name','note','tag','product_group','shelf','cabinet','warehouse','box'];

// ─── EXPORT ─────────────────────────────────────────────────────────────────

// GET /api/export/items.csv
router.get('/items.csv', authenticate, async (_req, res) => {
  try {
    const [rows] = await db.execute(ITEM_QUERY);
    const csv = stringify(rows, { header: true, columns: CSV_COLUMNS });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="items.csv"');
    res.send(csv);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/export/items.json
router.get('/items.json', authenticate, async (_req, res) => {
  try {
    const [rows] = await db.execute(ITEM_QUERY);
    res.setHeader('Content-Disposition', 'attachment; filename="items.json"');
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/export/warehouses.json  — full tree
router.get('/warehouses.json', authenticate, async (_req, res) => {
  try {
    const [warehouses] = await db.execute('SELECT ID, Varasto_nimi AS name FROM varastot ORDER BY Varasto_nimi');
    const [cabinets]   = await db.execute('SELECT ID, Kaappi_numero AS number, Varasto_id FROM kaapit ORDER BY Kaappi_numero');
    const [shelves]    = await db.execute('SELECT ID, Hylly_numero AS number, Kaappi_id FROM hyllyt ORDER BY Hylly_numero');
    const [items]      = await db.execute('SELECT ID, Nimi AS name, Huom AS note, Tunniste AS tag, Hylly_id FROM tavarat WHERE Hylly_id IS NOT NULL ORDER BY Nimi');

    const tree = warehouses.map(w => ({
      id:   w.ID,
      name: w.name,
      cabinets: cabinets
        .filter(c => c.Varasto_id === w.ID)
        .map(c => ({
          id:     c.ID,
          number: c.number,
          shelves: shelves
            .filter(s => s.Kaappi_id === c.ID)
            .map(s => ({
              id:     s.ID,
              number: s.number,
              items:  items.filter(i => i.Hylly_id === s.ID).map(i => ({
                id: i.ID, name: i.name, note: i.note, tag: i.tag,
              })),
            })),
        })),
    }));

    res.setHeader('Content-Disposition', 'attachment; filename="warehouses.json"');
    res.json(tree);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/export/reservations.csv
router.get('/reservations.csv', authenticate, requireAdmin, async (_req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT
        va.ID           AS id,
        kt.Nimi         AS user,
        t.Nimi          AS item,
        t.Tunniste      AS item_tag,
        v.Varasto_nimi  AS warehouse,
        k.Kaappi_numero AS cabinet,
        h.Hylly_numero  AS shelf,
        va.Varaus_alku  AS started_at,
        va.Varaus_loppu AS returned_at
      FROM varaukset va
      LEFT JOIN kayttaja_tiedot kt ON kt.ID = va.Kayttaja_id
      LEFT JOIN tavarat          t  ON t.ID  = va.Tavara_id
      LEFT JOIN hyllyt           h  ON h.ID  = t.Hylly_id
      LEFT JOIN kaapit           k  ON k.ID  = h.Kaappi_id
      LEFT JOIN varastot         v  ON v.ID  = k.Varasto_id
      ORDER BY va.Varaus_alku DESC
    `);
    const csv = stringify(rows, { header: true });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="reservations.csv"');
    res.send(csv);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// ─── IMPORT ─────────────────────────────────────────────────────────────────

/*
 * Both import endpoints:
 *   - look up warehouse/cabinet/shelf by name; create if missing (admin can opt-in via ?create_locations=1)
 *   - look up product group by name; create if missing
 *   - upsert item by name (INSERT … ON DUPLICATE KEY UPDATE)
 *   - return { inserted, updated, errors[] }
 *
 * Expected CSV/JSON columns (all optional except "name"):
 *   name, note, tag, product_group, warehouse, cabinet, shelf, box
 */

async function resolveOrCreate(conn, table, nameCol, idCol, name, allowCreate) {
  if (!name) return null;
  const [[row]] = await conn.execute(`SELECT ${idCol} AS id FROM ${table} WHERE ${nameCol} = ?`, [name]);
  if (row) return row.id;
  if (!allowCreate) return null;
  const [result] = await conn.execute(`INSERT INTO ${table} (${nameCol}) VALUES (?)`, [name]);
  return result.insertId;
}

async function processRows(rows, allowCreate) {
  const conn = await db.getConnection();
  const inserted = [];
  const updated  = [];
  const errors   = [];

  try {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.name || !String(row.name).trim()) {
        errors.push({ row: i + 1, error: 'name is required' });
        continue;
      }
      const name = String(row.name).trim();

      try {
        // Resolve foreign keys
        const tuoteryhmaId = await resolveOrCreate(conn, 'tuoteryhmat', 'Tuoteryhma', 'ID', row.product_group, allowCreate);
        const laatikoId    = await resolveOrCreate(conn, 'laatikot', 'Laatikko_nimi', 'ID', row.box, allowCreate);

        let hyllyId = null;
        if (row.warehouse && row.cabinet && row.shelf) {
          const varastoId = await resolveOrCreate(conn, 'varastot', 'Varasto_nimi', 'ID', row.warehouse, allowCreate);
          if (varastoId) {
            // Cabinet — scoped to warehouse
            let [[kaapiRow]] = await conn.execute(
              'SELECT ID FROM kaapit WHERE Kaappi_numero = ? AND Varasto_id = ?', [row.cabinet, varastoId]
            );
            let kaappiId = kaapiRow?.ID;
            if (!kaappiId && allowCreate) {
              const [r] = await conn.execute('INSERT INTO kaapit (Kaappi_numero, Varasto_id) VALUES (?,?)', [row.cabinet, varastoId]);
              kaappiId = r.insertId;
            }
            if (kaappiId) {
              let [[hyllyRow]] = await conn.execute(
                'SELECT ID FROM hyllyt WHERE Hylly_numero = ? AND Kaappi_id = ?', [row.shelf, kaappiId]
              );
              hyllyId = hyllyRow?.ID;
              if (!hyllyId && allowCreate) {
                const [r] = await conn.execute('INSERT INTO hyllyt (Hylly_numero, Kaappi_id) VALUES (?,?)', [row.shelf, kaappiId]);
                hyllyId = r.insertId;
              }
            }
          }
        }

        // Upsert item
        const [result] = await conn.execute(
          `INSERT INTO tavarat (Nimi, Huom, Tunniste, Tuoteryhma_id, Hylly_id, Laatikko_id)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             Huom          = VALUES(Huom),
             Tunniste      = VALUES(Tunniste),
             Tuoteryhma_id = VALUES(Tuoteryhma_id),
             Hylly_id      = VALUES(Hylly_id),
             Laatikko_id   = VALUES(Laatikko_id)`,
          [name, row.note || '', row.tag || null, tuoteryhmaId, hyllyId, laatikoId],
        );

        if (result.affectedRows === 1 && result.insertId > 0) inserted.push(name);
        else updated.push(name);
      } catch (rowErr) {
        errors.push({ row: i + 1, name, error: rowErr.message });
      }
    }
  } finally {
    conn.release();
  }

  return { inserted: inserted.length, updated: updated.length, errors };
}

// POST /api/import/items/csv
router.post(
  '/items/csv',
  authenticate, requireAdmin,
  upload.single('file'),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded. Field name must be "file".' });
    try {
      const rows = parse(req.file.buffer, {
        columns: true, skip_empty_lines: true, trim: true, bom: true,
      });
      const allowCreate = req.query.create_locations === '1';
      const result = await processRows(rows, allowCreate);
      res.status(result.errors.length && !result.inserted && !result.updated ? 422 : 200).json(result);
    } catch (err) {
      console.error(err);
      res.status(400).json({ error: 'Failed to parse CSV: ' + err.message });
    }
  },
);

// POST /api/import/items/json
router.post(
  '/items/json',
  authenticate, requireAdmin,
  async (req, res) => {
    const rows = Array.isArray(req.body) ? req.body : req.body?.items;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'Body must be a JSON array (or { items: [...] })' });
    }
    try {
      const allowCreate = req.query.create_locations === '1';
      const result = await processRows(rows, allowCreate);
      res.status(result.errors.length && !result.inserted && !result.updated ? 422 : 200).json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

module.exports = router;
