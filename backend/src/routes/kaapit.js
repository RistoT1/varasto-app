const router = require('express').Router();
const { body, param, query } = require('express-validator');
const pool = require('../db/pool');
const { asyncHandler, validate } = require('../middleware');

// ─── GET /kaapit ─────────────────────────────────────────────────────────────
// Optional: ?search=8.1  ?varasto_id=4  ?mapped=true (only cabinets with x/y set)
router.get(
  '/',
  [
    query('search').optional().isString().trim(),
    query('varasto_id').optional().isInt({ min: 1 }),
    query('mapped').optional().isBoolean(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { search, varasto_id, mapped } = req.query;
    const conditions = [];
    const params = [];

    if (search)     { conditions.push('k.Kaappi_numero LIKE ?'); params.push(`%${search}%`); }
    if (varasto_id) { conditions.push('k.Varasto_id = ?');       params.push(varasto_id); }
    if (mapped === 'true') {
      conditions.push('k.map_x IS NOT NULL AND k.map_y IS NOT NULL');
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT
        k.ID         AS id,
        k.Kaappi_numero AS number,
        k.Varasto_id AS varasto_id,
        k.map_x,
        k.map_y,
        v.Varasto_nimi AS varasto_nimi,
        COUNT(h.ID)  AS shelfCount
      FROM kaapit k
      JOIN varastot v ON v.ID = k.Varasto_id
      LEFT JOIN hyllyt h ON h.Kaappi_id = k.ID
      ${where}
      GROUP BY k.ID, k.Kaappi_numero, k.Varasto_id, k.map_x, k.map_y, v.Varasto_nimi
      ORDER BY v.Varasto_nimi, k.Kaappi_numero
    `;
    const [rows] = await pool.query(sql, params);
    res.json({ status: 'ok', count: rows.length, data: rows });
  })
);

// ─── GET /kaapit/:id ─────────────────────────────────────────────────────────
router.get(
  '/:id',
  [param('id').isInt({ min: 1 })],
  validate,
  asyncHandler(async (req, res) => {
    const [[row]] = await pool.query(
      `SELECT
         k.ID           AS id,
         k.Kaappi_numero AS number,
         k.Varasto_id   AS varasto_id,
         k.map_x,
         k.map_y,
         v.Varasto_nimi  AS varasto_nimi
       FROM kaapit k
       JOIN varastot v ON v.ID = k.Varasto_id
       WHERE k.ID = ?`,
      [req.params.id]
    );
    if (!row) return res.status(404).json({ status: 'error', message: 'Kaappi not found' });
    res.json({ status: 'ok', data: row });
  })
);

// ─── GET /kaapit/:id/hyllyt ──────────────────────────────────────────────────
router.get(
  '/:id/hyllyt',
  [param('id').isInt({ min: 1 })],
  validate,
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT
         h.ID             AS id,
         h.Hylly_numero   AS number,
         h.Kaappi_id      AS kaappi_id,
         COUNT(t.ID)      AS itemCount
       FROM hyllyt h
       LEFT JOIN tavarat t ON t.Hylly_id = h.ID
       WHERE h.Kaappi_id = ?
       GROUP BY h.ID, h.Hylly_numero, h.Kaappi_id
       ORDER BY h.Hylly_numero`,
      [req.params.id]
    );
    res.json({ status: 'ok', count: rows.length, data: rows });
  })
);

// ─── POST /kaapit ────────────────────────────────────────────────────────────
router.post(
  '/',
  [
    body('number').trim().notEmpty().isLength({ max: 8 }),
    body('varasto_id').isInt({ min: 1 }),
    body('map_x').optional({ nullable: true }).isInt(),
    body('map_y').optional({ nullable: true }).isInt(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { number, varasto_id, map_x = null, map_y = null } = req.body;
    const [result] = await pool.query(
      'INSERT INTO kaapit (Kaappi_numero, Varasto_id, map_x, map_y) VALUES (?, ?, ?, ?)',
      [number, varasto_id, map_x, map_y]
    );
    const [[row]] = await pool.query(
      `SELECT k.ID AS id, k.Kaappi_numero AS number, k.Varasto_id AS varasto_id,
              k.map_x, k.map_y, v.Varasto_nimi AS varasto_nimi
       FROM kaapit k JOIN varastot v ON v.ID = k.Varasto_id WHERE k.ID = ?`,
      [result.insertId]
    );
    res.status(201).json({ status: 'ok', data: row });
  })
);

// ─── PUT /kaapit/:id ─────────────────────────────────────────────────────────
router.put(
  '/:id',
  [
    param('id').isInt({ min: 1 }),
    body('number').trim().notEmpty().isLength({ max: 8 }),
    body('varasto_id').isInt({ min: 1 }),
    body('map_x').optional({ nullable: true }).isInt(),
    body('map_y').optional({ nullable: true }).isInt(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { number, varasto_id, map_x = null, map_y = null } = req.body;
    const [result] = await pool.query(
      'UPDATE kaapit SET Kaappi_numero = ?, Varasto_id = ?, map_x = ?, map_y = ? WHERE ID = ?',
      [number, varasto_id, map_x, map_y, req.params.id]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ status: 'error', message: 'Kaappi not found' });
    const [[row]] = await pool.query(
      `SELECT k.ID AS id, k.Kaappi_numero AS number, k.Varasto_id AS varasto_id,
              k.map_x, k.map_y, v.Varasto_nimi AS varasto_nimi
       FROM kaapit k JOIN varastot v ON v.ID = k.Varasto_id WHERE k.ID = ?`,
      [req.params.id]
    );
    res.json({ status: 'ok', data: row });
  })
);

// ─── PATCH /kaapit/:id/position ──────────────────────────────────────────────
// Lightweight endpoint just for saving map drag position.
// Body: { map_x: 120, map_y: 450 }
// Send { map_x: null, map_y: null } to remove from map.
router.patch(
  '/:id/position',
  [
    param('id').isInt({ min: 1 }),
    body('map_x').isInt().withMessage('map_x must be an integer').optional({ nullable: true }),
    body('map_y').isInt().withMessage('map_y must be an integer').optional({ nullable: true }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { map_x = null, map_y = null } = req.body;
    const [result] = await pool.query(
      'UPDATE kaapit SET map_x = ?, map_y = ? WHERE ID = ?',
      [map_x, map_y, req.params.id]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ status: 'error', message: 'Kaappi not found' });
    res.json({ status: 'ok', data: { id: Number(req.params.id), map_x, map_y } });
  })
);

// ─── DELETE /kaapit/:id ──────────────────────────────────────────────────────
router.delete(
  '/:id',
  [param('id').isInt({ min: 1 })],
  validate,
  asyncHandler(async (req, res) => {
    const [result] = await pool.query('DELETE FROM kaapit WHERE ID = ?', [req.params.id]);
    if (result.affectedRows === 0)
      return res.status(404).json({ status: 'error', message: 'Kaappi not found' });
    res.json({ status: 'ok', message: 'Deleted successfully' });
  })
);

module.exports = router;