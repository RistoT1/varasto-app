const router = require('express').Router();
const { body, param } = require('express-validator');
const pool = require('../db/pool');
const { asyncHandler, validate } = require('../middleware');

router.get('/', asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM kayttoluvat ORDER BY Kayttolupa');
  res.json({ status: 'ok', count: rows.length, data: rows });
}));

router.get('/:id',
  [param('id').isInt({ min: 1 })], validate,
  asyncHandler(async (req, res) => {
    const [[row]] = await pool.query('SELECT * FROM kayttoluvat WHERE ID = ?', [req.params.id]);
    if (!row) return res.status(404).json({ status: 'error', message: 'Käyttölupa not found' });
    res.json({ status: 'ok', data: row });
  })
);

router.post('/',
  [body('Kayttolupa').trim().notEmpty().isLength({ max: 128 })], validate,
  asyncHandler(async (req, res) => {
    const [result] = await pool.query('INSERT INTO kayttoluvat (Kayttolupa) VALUES (?)', [req.body.Kayttolupa]);
    const [[row]] = await pool.query('SELECT * FROM kayttoluvat WHERE ID = ?', [result.insertId]);
    res.status(201).json({ status: 'ok', data: row });
  })
);

router.put('/:id',
  [param('id').isInt({ min: 1 }), body('Kayttolupa').trim().notEmpty().isLength({ max: 128 })], validate,
  asyncHandler(async (req, res) => {
    const [result] = await pool.query('UPDATE kayttoluvat SET Kayttolupa = ? WHERE ID = ?', [req.body.Kayttolupa, req.params.id]);
    if (result.affectedRows === 0)
      return res.status(404).json({ status: 'error', message: 'Käyttölupa not found' });
    const [[row]] = await pool.query('SELECT * FROM kayttoluvat WHERE ID = ?', [req.params.id]);
    res.json({ status: 'ok', data: row });
  })
);

router.delete('/:id',
  [param('id').isInt({ min: 1 })], validate,
  asyncHandler(async (req, res) => {
    const [result] = await pool.query('DELETE FROM kayttoluvat WHERE ID = ?', [req.params.id]);
    if (result.affectedRows === 0)
      return res.status(404).json({ status: 'error', message: 'Käyttölupa not found' });
    res.json({ status: 'ok', message: 'Deleted successfully' });
  })
);

module.exports = router;
