const router = require('express').Router();
const { body, param, query } = require('express-validator');
const pool = require('../db/pool');
const { asyncHandler, validate } = require('../middleware');

// ─── GET /hyllyt ─────────────────────────────────────────────────────────────
// Optional: ?search=1.1  ?kaappi_id=5  ?varasto_id=2
router.get(
  '/',
  [
    query('search').optional().isString().trim(),
    query('kaappi_id').optional().isInt({ min: 1 }),
    query('varasto_id').optional().isInt({ min: 1 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { search, kaappi_id, varasto_id } = req.query;
    const conditions = [];
    const params = [];

    if (search)     { conditions.push('h.Hylly_numero LIKE ?');   params.push(`%${search}%`); }
    if (kaappi_id)  { conditions.push('h.Kaappi_id = ?');         params.push(kaappi_id); }
    if (varasto_id) { conditions.push('k.Varasto_id = ?');        params.push(varasto_id); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT h.*, k.Kaappi_numero, v.ID AS Varasto_id, v.Varasto_nimi
      FROM hyllyt h
      JOIN kaapit   k ON k.ID = h.Kaappi_id
      JOIN varastot v ON v.ID = k.Varasto_id
      ${where}
      ORDER BY v.Varasto_nimi, k.Kaappi_numero, h.Hylly_numero
    `;
    const [rows] = await pool.query(sql, params);
    res.json({ status: 'ok', count: rows.length, data: rows });
  })
);

// ─── GET /hyllyt/:id ─────────────────────────────────────────────────────────
router.get(
  '/:id',
  [param('id').isInt({ min: 1 })],
  validate,
  asyncHandler(async (req, res) => {
    const [[row]] = await pool.query(
      `SELECT h.*, k.Kaappi_numero, v.ID AS Varasto_id, v.Varasto_nimi
       FROM hyllyt h
       JOIN kaapit   k ON k.ID = h.Kaappi_id
       JOIN varastot v ON v.ID = k.Varasto_id
       WHERE h.ID = ?`,
      [req.params.id]
    );
    if (!row) return res.status(404).json({ status: 'error', message: 'Hylly not found' });
    res.json({ status: 'ok', data: row });
  })
);

// ─── GET /hyllyt/:id/tavarat ─────────────────────────────────────────────────
router.get(
  '/:id/tavarat',
  [param('id').isInt({ min: 1 })],
  validate,
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT t.*, tr.Tuoteryhma, l.Laatikko_nimi
       FROM tavarat t
       LEFT JOIN tuoteryhmat tr ON tr.ID = t.Tuoteryhma_id
       LEFT JOIN laatikot    l  ON l.ID  = t.Laatikko_id
       WHERE t.Hylly_id = ?
       ORDER BY t.Nimi`,
      [req.params.id]
    );
    res.json({ status: 'ok', count: rows.length, data: rows });
  })
);

// ─── POST /hyllyt ────────────────────────────────────────────────────────────
router.post(
  '/',
  [
    body('Hylly_numero').trim().notEmpty().isLength({ max: 8 }),
    body('Kaappi_id').isInt({ min: 1 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { Hylly_numero, Kaappi_id } = req.body;
    const [result] = await pool.query(
      'INSERT INTO hyllyt (Hylly_numero, Kaappi_id) VALUES (?, ?)',
      [Hylly_numero, Kaappi_id]
    );
    const [[row]] = await pool.query(
      `SELECT h.*, k.Kaappi_numero, v.ID AS Varasto_id, v.Varasto_nimi
       FROM hyllyt h JOIN kaapit k ON k.ID = h.Kaappi_id JOIN varastot v ON v.ID = k.Varasto_id
       WHERE h.ID = ?`,
      [result.insertId]
    );
    res.status(201).json({ status: 'ok', data: row });
  })
);

// ─── PUT /hyllyt/:id ─────────────────────────────────────────────────────────
router.put(
  '/:id',
  [
    param('id').isInt({ min: 1 }),
    body('Hylly_numero').trim().notEmpty().isLength({ max: 8 }),
    body('Kaappi_id').isInt({ min: 1 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { Hylly_numero, Kaappi_id } = req.body;
    const [result] = await pool.query(
      'UPDATE hyllyt SET Hylly_numero = ?, Kaappi_id = ? WHERE ID = ?',
      [Hylly_numero, Kaappi_id, req.params.id]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ status: 'error', message: 'Hylly not found' });
    const [[row]] = await pool.query(
      `SELECT h.*, k.Kaappi_numero, v.ID AS Varasto_id, v.Varasto_nimi
       FROM hyllyt h JOIN kaapit k ON k.ID = h.Kaappi_id JOIN varastot v ON v.ID = k.Varasto_id
       WHERE h.ID = ?`,
      [req.params.id]
    );
    res.json({ status: 'ok', data: row });
  })
);

// ─── DELETE /hyllyt/:id ──────────────────────────────────────────────────────
router.delete(
  '/:id',
  [param('id').isInt({ min: 1 })],
  validate,
  asyncHandler(async (req, res) => {
    const [result] = await pool.query('DELETE FROM hyllyt WHERE ID = ?', [req.params.id]);
    if (result.affectedRows === 0)
      return res.status(404).json({ status: 'error', message: 'Hylly not found' });
    res.json({ status: 'ok', message: 'Deleted successfully' });
  })
);

module.exports = router;
