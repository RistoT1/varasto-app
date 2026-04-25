const router = require('express').Router();
const { body, param, query } = require('express-validator');
const pool = require('../db/pool');
const { asyncHandler, validate } = require('../middleware');

// Never return Salasana or Autologin_key in list/detail responses
const SAFE_COLS = 'kt.ID, kt.Nimi, kt.Aktiivinen, kt.Kayttolupa_id, kl.Kayttolupa';
const BASE_FROM = `
  FROM kayttaja_tiedot kt
  LEFT JOIN kayttoluvat kl ON kl.ID = kt.Kayttolupa_id
`;

// ─── GET /kayttajat ──────────────────────────────────────────────────────────
router.get(
  '/',
  [
    query('search').optional().isString().trim(),
    query('kayttolupa_id').optional().isInt({ min: 1 }),
    query('aktiivinen').optional().isBoolean(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { search, kayttolupa_id, aktiivinen } = req.query;
    const conditions = [];
    const params = [];

    if (search)       { conditions.push('kt.Nimi LIKE ?');           params.push(`%${search}%`); }
    if (kayttolupa_id){ conditions.push('kt.Kayttolupa_id = ?');     params.push(kayttolupa_id); }
    if (aktiivinen !== undefined) {
      conditions.push('kt.Aktiivinen = ?');
      params.push(aktiivinen === 'true' ? 1 : 0);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await pool.query(
      `SELECT ${SAFE_COLS} ${BASE_FROM} ${where} ORDER BY kt.Nimi`,
      params
    );
    res.json({ status: 'ok', count: rows.length, data: rows });
  })
);

// ─── GET /kayttajat/:id ──────────────────────────────────────────────────────
router.get(
  '/:id',
  [param('id').isInt({ min: 1 })],
  validate,
  asyncHandler(async (req, res) => {
    const [[row]] = await pool.query(
      `SELECT ${SAFE_COLS} ${BASE_FROM} WHERE kt.ID = ?`,
      [req.params.id]
    );
    if (!row) return res.status(404).json({ status: 'error', message: 'Käyttäjä not found' });
    res.json({ status: 'ok', data: row });
  })
);

// ─── GET /kayttajat/:id/varaukset ────────────────────────────────────────────
router.get(
  '/:id/varaukset',
  [param('id').isInt({ min: 1 }), query('active').optional().isBoolean()],
  validate,
  asyncHandler(async (req, res) => {
    const { active } = req.query;
    const conditions = ['va.Kayttaja_id = ?'];
    const params = [req.params.id];

    if (active === 'true')  conditions.push('va.Varaus_loppu IS NULL');
    if (active === 'false') conditions.push('va.Varaus_loppu IS NOT NULL');

    const [rows] = await pool.query(
      `SELECT va.*, t.Nimi AS Tavara_nimi
       FROM varaukset va
       JOIN tavarat t ON t.ID = va.Tavara_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY va.Varaus_alku DESC`,
      params
    );
    res.json({ status: 'ok', count: rows.length, data: rows });
  })
);

// ─── POST /kayttajat ─────────────────────────────────────────────────────────
// NOTE: In production, hash the password before storing. This stores it as-is
// because the existing schema already contains bcrypt hashes — wire in bcrypt
// in your auth layer when you implement login.
router.post(
  '/',
  [
    body('Nimi').trim().notEmpty().isLength({ max: 64 }),
    body('Salasana').notEmpty().isLength({ min: 8 }),
    body('Kayttolupa_id').optional({ nullable: true }).isInt({ min: 1 }),
    body('Aktiivinen').optional().isBoolean(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { Nimi, Salasana, Kayttolupa_id = null, Aktiivinen = 1 } = req.body;
    const [result] = await pool.query(
      'INSERT INTO kayttaja_tiedot (Nimi, Salasana, Kayttolupa_id, Aktiivinen) VALUES (?,?,?,?)',
      [Nimi, Salasana, Kayttolupa_id, Aktiivinen ? 1 : 0]
    );
    const [[row]] = await pool.query(
      `SELECT ${SAFE_COLS} ${BASE_FROM} WHERE kt.ID = ?`,
      [result.insertId]
    );
    res.status(201).json({ status: 'ok', data: row });
  })
);

// ─── PUT /kayttajat/:id ──────────────────────────────────────────────────────
router.put(
  '/:id',
  [
    param('id').isInt({ min: 1 }),
    body('Nimi').trim().notEmpty().isLength({ max: 64 }),
    body('Kayttolupa_id').optional({ nullable: true }).isInt({ min: 1 }),
    body('Aktiivinen').optional().isBoolean(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { Nimi, Kayttolupa_id = null, Aktiivinen = 1 } = req.body;
    const [result] = await pool.query(
      'UPDATE kayttaja_tiedot SET Nimi=?, Kayttolupa_id=?, Aktiivinen=? WHERE ID=?',
      [Nimi, Kayttolupa_id, Aktiivinen ? 1 : 0, req.params.id]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ status: 'error', message: 'Käyttäjä not found' });
    const [[row]] = await pool.query(
      `SELECT ${SAFE_COLS} ${BASE_FROM} WHERE kt.ID = ?`,
      [req.params.id]
    );
    res.json({ status: 'ok', data: row });
  })
);

// ─── DELETE /kayttajat/:id ───────────────────────────────────────────────────
router.delete(
  '/:id',
  [param('id').isInt({ min: 1 })],
  validate,
  asyncHandler(async (req, res) => {
    const [result] = await pool.query('DELETE FROM kayttaja_tiedot WHERE ID = ?', [req.params.id]);
    if (result.affectedRows === 0)
      return res.status(404).json({ status: 'error', message: 'Käyttäjä not found' });
    res.json({ status: 'ok', message: 'Deleted successfully' });
  })
);

module.exports = router;
