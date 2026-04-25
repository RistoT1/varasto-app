const router = require('express').Router();
const { body, param, query } = require('express-validator');
const pool = require('../db/pool');
const { asyncHandler, validate } = require('../middleware');

/* ─── Shared column list for SELECT ──────────────────────────────────────── */
const SELECT_COLS = `
  t.ID,
  t.Nimi,
  t.Huom,
  t.Tunniste,
  t.Tuoteryhma_id,
  tr.Tuoteryhma,
  t.Hylly_id,
  h.Hylly_numero,
  k.ID   AS Kaappi_id,
  k.Kaappi_numero,
  v.ID   AS Varasto_id,
  v.Varasto_nimi,
  t.Laatikko_id,
  l.Laatikko_nimi
`;

const BASE_FROM = `
  FROM tavarat t
  LEFT JOIN tuoteryhmat tr ON tr.ID = t.Tuoteryhma_id
  LEFT JOIN hyllyt      h  ON h.ID  = t.Hylly_id
  LEFT JOIN kaapit      k  ON k.ID  = h.Kaappi_id
  LEFT JOIN varastot    v  ON v.ID  = k.Varasto_id
  LEFT JOIN laatikot    l  ON l.ID  = t.Laatikko_id
`;

// ─── GET /tavarat ─────────────────────────────────────────────────────────────
// Supports: ?search=  ?tunniste=  ?tuoteryhma_id=  ?varasto_id=
//           ?kaappi_id=  ?hylly_id=  ?laatikko_id=
//           ?page=  ?limit=  ?sort=Nimi|ID  ?order=asc|desc
router.get(
  '/',
  [
    query('search').optional().isString().trim(),
    query('tunniste').optional().isString().trim(),
    query('tuoteryhma_id').optional().isInt({ min: 1 }),
    query('varasto_id').optional().isInt({ min: 1 }),
    query('kaappi_id').optional().isInt({ min: 1 }),
    query('hylly_id').optional().isInt({ min: 1 }),
    query('laatikko_id').optional().isInt({ min: 1 }),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 500 }).toInt(),
    query('sort').optional().isIn(['Nimi', 'ID', 'Tuoteryhma', 'Varasto_nimi']),
    query('order').optional().isIn(['asc', 'desc']),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const {
      search, tunniste,
      tuoteryhma_id, varasto_id, kaappi_id, hylly_id, laatikko_id,
      page = 1, limit = 100,
      sort = 'Nimi', order = 'asc',
    } = req.query;

    const conditions = [];
    const params = [];

    if (search)        { conditions.push('t.Nimi LIKE ?');             params.push(`%${search}%`); }
    if (tunniste)      { conditions.push('t.Tunniste = ?');            params.push(tunniste); }
    if (tuoteryhma_id) { conditions.push('t.Tuoteryhma_id = ?');       params.push(tuoteryhma_id); }
    if (varasto_id)    { conditions.push('v.ID = ?');                  params.push(varasto_id); }
    if (kaappi_id)     { conditions.push('k.ID = ?');                  params.push(kaappi_id); }
    if (hylly_id)      { conditions.push('t.Hylly_id = ?');            params.push(hylly_id); }
    if (laatikko_id)   { conditions.push('t.Laatikko_id = ?');         params.push(laatikko_id); }

    const where  = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    // safe — sort is whitelisted above
    const orderClause = `ORDER BY ${sort} ${order.toUpperCase()}`;
    const offset = (page - 1) * limit;

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total ${BASE_FROM} ${where}`,
      params
    );

    const [rows] = await pool.query(
      `SELECT ${SELECT_COLS} ${BASE_FROM} ${where} ${orderClause} LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      status: 'ok',
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      count: rows.length,
      data: rows,
    });
  })
);

// ─── GET /tavarat/search ─────────────────────────────────────────────────────
// Dedicated fast-search endpoint: ?q=cisco  (searches Nimi + Tunniste + Huom)
router.get(
  '/search',
  [query('q').notEmpty().isString().trim().isLength({ min: 1, max: 100 })],
  validate,
  asyncHandler(async (req, res) => {
    const { q } = req.query;
    const like = `%${q}%`;
    const [rows] = await pool.query(
      `SELECT ${SELECT_COLS} ${BASE_FROM}
       WHERE t.Nimi LIKE ? OR t.Tunniste LIKE ? OR t.Huom LIKE ?
       ORDER BY
         CASE WHEN t.Nimi LIKE ? THEN 0 ELSE 1 END,
         t.Nimi
       LIMIT 50`,
      [like, like, like, `${q}%`]
    );
    res.json({ status: 'ok', count: rows.length, data: rows });
  })
);

// ─── GET /tavarat/:id ─────────────────────────────────────────────────────────
router.get(
  '/:id',
  [param('id').isInt({ min: 1 })],
  validate,
  asyncHandler(async (req, res) => {
    const [[row]] = await pool.query(
      `SELECT ${SELECT_COLS} ${BASE_FROM} WHERE t.ID = ?`,
      [req.params.id]
    );
    if (!row) return res.status(404).json({ status: 'error', message: 'Tavara not found' });
    res.json({ status: 'ok', data: row });
  })
);

// ─── GET /tavarat/:id/varaukset ───────────────────────────────────────────────
router.get(
  '/:id/varaukset',
  [param('id').isInt({ min: 1 })],
  validate,
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT va.*, kt.Nimi AS Kayttaja_nimi
       FROM varaukset va
       LEFT JOIN kayttaja_tiedot kt ON kt.ID = va.Kayttaja_id
       WHERE va.Tavara_id = ?
       ORDER BY va.Varaus_alku DESC`,
      [req.params.id]
    );
    res.json({ status: 'ok', count: rows.length, data: rows });
  })
);

// ─── POST /tavarat ────────────────────────────────────────────────────────────
router.post(
  '/',
  [
    body('Nimi').trim().notEmpty().isLength({ max: 128 }),
    body('Tuoteryhma_id').optional({ nullable: true }).isInt({ min: 1 }),
    body('Hylly_id').optional({ nullable: true }).isInt({ min: 1 }),
    body('Huom').optional().trim().isLength({ max: 255 }),
    body('Laatikko_id').optional({ nullable: true }).isInt({ min: 1 }),
    body('Tunniste').optional({ nullable: true }).trim().isLength({ max: 16 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { Nimi, Tuoteryhma_id = null, Hylly_id = null, Huom = '', Laatikko_id = null, Tunniste = null } = req.body;
    const [result] = await pool.query(
      'INSERT INTO tavarat (Nimi, Tuoteryhma_id, Hylly_id, Huom, Laatikko_id, Tunniste) VALUES (?,?,?,?,?,?)',
      [Nimi, Tuoteryhma_id, Hylly_id, Huom, Laatikko_id, Tunniste]
    );
    const [[row]] = await pool.query(
      `SELECT ${SELECT_COLS} ${BASE_FROM} WHERE t.ID = ?`,
      [result.insertId]
    );
    res.status(201).json({ status: 'ok', data: row });
  })
);

// ─── PUT /tavarat/:id ────────────────────────────────────────────────────────
router.put(
  '/:id',
  [
    param('id').isInt({ min: 1 }),
    body('Nimi').trim().notEmpty().isLength({ max: 128 }),
    body('Tuoteryhma_id').optional({ nullable: true }).isInt({ min: 1 }),
    body('Hylly_id').optional({ nullable: true }).isInt({ min: 1 }),
    body('Huom').optional().trim().isLength({ max: 255 }),
    body('Laatikko_id').optional({ nullable: true }).isInt({ min: 1 }),
    body('Tunniste').optional({ nullable: true }).trim().isLength({ max: 16 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { Nimi, Tuoteryhma_id = null, Hylly_id = null, Huom = '', Laatikko_id = null, Tunniste = null } = req.body;
    const [result] = await pool.query(
      'UPDATE tavarat SET Nimi=?, Tuoteryhma_id=?, Hylly_id=?, Huom=?, Laatikko_id=?, Tunniste=? WHERE ID=?',
      [Nimi, Tuoteryhma_id, Hylly_id, Huom, Laatikko_id, Tunniste, req.params.id]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ status: 'error', message: 'Tavara not found' });
    const [[row]] = await pool.query(
      `SELECT ${SELECT_COLS} ${BASE_FROM} WHERE t.ID = ?`,
      [req.params.id]
    );
    res.json({ status: 'ok', data: row });
  })
);

// ─── PATCH /tavarat/:id ───────────────────────────────────────────────────────
// Partial update — only provided fields are updated
router.patch(
  '/:id',
  [
    param('id').isInt({ min: 1 }),
    body('Nimi').optional().trim().notEmpty().isLength({ max: 128 }),
    body('Tuoteryhma_id').optional({ nullable: true }).isInt({ min: 1 }),
    body('Hylly_id').optional({ nullable: true }).isInt({ min: 1 }),
    body('Huom').optional().trim().isLength({ max: 255 }),
    body('Laatikko_id').optional({ nullable: true }).isInt({ min: 1 }),
    body('Tunniste').optional({ nullable: true }).trim().isLength({ max: 16 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const allowed = ['Nimi', 'Tuoteryhma_id', 'Hylly_id', 'Huom', 'Laatikko_id', 'Tunniste'];
    const fields  = Object.keys(req.body).filter(k => allowed.includes(k));

    if (fields.length === 0)
      return res.status(422).json({ status: 'error', message: 'No valid fields provided' });

    const set    = fields.map(f => `${f} = ?`).join(', ');
    const params = [...fields.map(f => req.body[f]), req.params.id];

    const [result] = await pool.query(`UPDATE tavarat SET ${set} WHERE ID = ?`, params);
    if (result.affectedRows === 0)
      return res.status(404).json({ status: 'error', message: 'Tavara not found' });

    const [[row]] = await pool.query(
      `SELECT ${SELECT_COLS} ${BASE_FROM} WHERE t.ID = ?`,
      [req.params.id]
    );
    res.json({ status: 'ok', data: row });
  })
);

// ─── DELETE /tavarat/:id ─────────────────────────────────────────────────────
router.delete(
  '/:id',
  [param('id').isInt({ min: 1 })],
  validate,
  asyncHandler(async (req, res) => {
    const [result] = await pool.query('DELETE FROM tavarat WHERE ID = ?', [req.params.id]);
    if (result.affectedRows === 0)
      return res.status(404).json({ status: 'error', message: 'Tavara not found' });
    res.json({ status: 'ok', message: 'Deleted successfully' });
  })
);

module.exports = router;
