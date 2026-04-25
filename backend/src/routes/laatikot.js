const router = require('express').Router();
const { body, param, query } = require('express-validator');
const pool = require('../db/pool');
const { asyncHandler, validate } = require('../middleware');

// ─── GET /laatikot ───────────────────────────────────────────────────────────
router.get(
  '/',
  [query('search').optional().isString().trim()],
  validate,
  asyncHandler(async (req, res) => {
    const { search } = req.query;
    const sql = search
      ? 'SELECT * FROM laatikot WHERE Laatikko_nimi LIKE ? ORDER BY Laatikko_nimi'
      : 'SELECT * FROM laatikot ORDER BY Laatikko_nimi';
    const [rows] = await pool.query(sql, search ? [`%${search}%`] : []);
    res.json({ status: 'ok', count: rows.length, data: rows });
  })
);

// ─── GET /laatikot/:id ───────────────────────────────────────────────────────
router.get(
  '/:id',
  [param('id').isInt({ min: 1 })],
  validate,
  asyncHandler(async (req, res) => {
    const [[row]] = await pool.query('SELECT * FROM laatikot WHERE ID = ?', [req.params.id]);
    if (!row) return res.status(404).json({ status: 'error', message: 'Laatikko not found' });
    res.json({ status: 'ok', data: row });
  })
);

// ─── GET /laatikot/:id/tavarat ───────────────────────────────────────────────
router.get(
  '/:id/tavarat',
  [param('id').isInt({ min: 1 })],
  validate,
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT t.*, tr.Tuoteryhma, h.Hylly_numero, k.Kaappi_numero, v.Varasto_nimi
       FROM tavarat t
       LEFT JOIN tuoteryhmat tr ON tr.ID = t.Tuoteryhma_id
       LEFT JOIN hyllyt      h  ON h.ID  = t.Hylly_id
       LEFT JOIN kaapit      k  ON k.ID  = h.Kaappi_id
       LEFT JOIN varastot    v  ON v.ID  = k.Varasto_id
       WHERE t.Laatikko_id = ?
       ORDER BY t.Nimi`,
      [req.params.id]
    );
    res.json({ status: 'ok', count: rows.length, data: rows });
  })
);

// ─── POST /laatikot ──────────────────────────────────────────────────────────
router.post(
  '/',
  [body('Laatikko_nimi').trim().notEmpty().isLength({ max: 128 })],
  validate,
  asyncHandler(async (req, res) => {
    const [result] = await pool.query(
      'INSERT INTO laatikot (Laatikko_nimi) VALUES (?)',
      [req.body.Laatikko_nimi]
    );
    const [[row]] = await pool.query('SELECT * FROM laatikot WHERE ID = ?', [result.insertId]);
    res.status(201).json({ status: 'ok', data: row });
  })
);

// ─── PUT /laatikot/:id ───────────────────────────────────────────────────────
router.put(
  '/:id',
  [param('id').isInt({ min: 1 }), body('Laatikko_nimi').trim().notEmpty().isLength({ max: 128 })],
  validate,
  asyncHandler(async (req, res) => {
    const [result] = await pool.query(
      'UPDATE laatikot SET Laatikko_nimi = ? WHERE ID = ?',
      [req.body.Laatikko_nimi, req.params.id]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ status: 'error', message: 'Laatikko not found' });
    const [[row]] = await pool.query('SELECT * FROM laatikot WHERE ID = ?', [req.params.id]);
    res.json({ status: 'ok', data: row });
  })
);

// ─── DELETE /laatikot/:id ────────────────────────────────────────────────────
router.delete(
  '/:id',
  [param('id').isInt({ min: 1 })],
  validate,
  asyncHandler(async (req, res) => {
    const [result] = await pool.query('DELETE FROM laatikot WHERE ID = ?', [req.params.id]);
    if (result.affectedRows === 0)
      return res.status(404).json({ status: 'error', message: 'Laatikko not found' });
    res.json({ status: 'ok', message: 'Deleted successfully' });
  })
);

module.exports = router;
