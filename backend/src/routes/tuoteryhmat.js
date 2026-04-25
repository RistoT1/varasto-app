const router = require('express').Router();
const { body, param, query } = require('express-validator');
const pool = require('../db/pool');
const { asyncHandler, validate } = require('../middleware');

// ─── GET /tuoteryhmat ────────────────────────────────────────────────────────
router.get(
  '/',
  [query('search').optional().isString().trim()],
  validate,
  asyncHandler(async (req, res) => {
    const { search } = req.query;
    const sql = search
      ? 'SELECT * FROM tuoteryhmat WHERE Tuoteryhma LIKE ? ORDER BY Tuoteryhma'
      : 'SELECT * FROM tuoteryhmat ORDER BY Tuoteryhma';
    const [rows] = await pool.query(sql, search ? [`%${search}%`] : []);
    res.json({ status: 'ok', count: rows.length, data: rows });
  })
);

// ─── GET /tuoteryhmat/:id ────────────────────────────────────────────────────
router.get(
  '/:id',
  [param('id').isInt({ min: 1 })],
  validate,
  asyncHandler(async (req, res) => {
    const [[row]] = await pool.query('SELECT * FROM tuoteryhmat WHERE ID = ?', [req.params.id]);
    if (!row) return res.status(404).json({ status: 'error', message: 'Tuoteryhmä not found' });
    res.json({ status: 'ok', data: row });
  })
);

// ─── GET /tuoteryhmat/:id/tavarat ────────────────────────────────────────────
router.get(
  '/:id/tavarat',
  [param('id').isInt({ min: 1 })],
  validate,
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT t.*, h.Hylly_numero, k.Kaappi_numero, v.Varasto_nimi
       FROM tavarat t
       LEFT JOIN hyllyt   h ON h.ID = t.Hylly_id
       LEFT JOIN kaapit   k ON k.ID = h.Kaappi_id
       LEFT JOIN varastot v ON v.ID = k.Varasto_id
       WHERE t.Tuoteryhma_id = ?
       ORDER BY t.Nimi`,
      [req.params.id]
    );
    res.json({ status: 'ok', count: rows.length, data: rows });
  })
);

// ─── POST /tuoteryhmat ───────────────────────────────────────────────────────
router.post(
  '/',
  [body('Tuoteryhma').trim().notEmpty().isLength({ max: 64 })],
  validate,
  asyncHandler(async (req, res) => {
    const [result] = await pool.query(
      'INSERT INTO tuoteryhmat (Tuoteryhma) VALUES (?)',
      [req.body.Tuoteryhma]
    );
    const [[row]] = await pool.query('SELECT * FROM tuoteryhmat WHERE ID = ?', [result.insertId]);
    res.status(201).json({ status: 'ok', data: row });
  })
);

// ─── PUT /tuoteryhmat/:id ────────────────────────────────────────────────────
router.put(
  '/:id',
  [param('id').isInt({ min: 1 }), body('Tuoteryhma').trim().notEmpty().isLength({ max: 64 })],
  validate,
  asyncHandler(async (req, res) => {
    const [result] = await pool.query(
      'UPDATE tuoteryhmat SET Tuoteryhma = ? WHERE ID = ?',
      [req.body.Tuoteryhma, req.params.id]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ status: 'error', message: 'Tuoteryhmä not found' });
    const [[row]] = await pool.query('SELECT * FROM tuoteryhmat WHERE ID = ?', [req.params.id]);
    res.json({ status: 'ok', data: row });
  })
);

// ─── DELETE /tuoteryhmat/:id ─────────────────────────────────────────────────
router.delete(
  '/:id',
  [param('id').isInt({ min: 1 })],
  validate,
  asyncHandler(async (req, res) => {
    const [result] = await pool.query('DELETE FROM tuoteryhmat WHERE ID = ?', [req.params.id]);
    if (result.affectedRows === 0)
      return res.status(404).json({ status: 'error', message: 'Tuoteryhmä not found' });
    res.json({ status: 'ok', message: 'Deleted successfully' });
  })
);

module.exports = router;
