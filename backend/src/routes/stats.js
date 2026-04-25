'use strict';

/**
 * Stats / dashboard endpoint
 *
 * GET /api/stats            overall counts + top-level summary
 * GET /api/stats/warehouses breakdown per warehouse
 * GET /api/stats/groups     breakdown per product group
 * GET /api/stats/activity   reservation activity (last 30 days)
 */

const router = require('express').Router();
const { query } = require('express-validator');
const db = require('../config/db');
const { validate }     = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');

// GET /api/stats
router.get('/', authenticate, async (_req, res) => {
  try {
    const [[counts]] = await db.execute(`
      SELECT
        (SELECT COUNT(*) FROM tavarat)       AS total_items,
        (SELECT COUNT(*) FROM varastot)      AS total_warehouses,
        (SELECT COUNT(*) FROM kaapit)        AS total_cabinets,
        (SELECT COUNT(*) FROM hyllyt)        AS total_shelves,
        (SELECT COUNT(*) FROM laatikot)      AS total_boxes,
        (SELECT COUNT(*) FROM tuoteryhmat)   AS total_product_groups,
        (SELECT COUNT(*) FROM varaukset WHERE Varaus_loppu IS NULL)  AS active_reservations,
        (SELECT COUNT(*) FROM varaukset)                             AS total_reservations,
        (SELECT COUNT(*) FROM kayttaja_tiedot WHERE Aktiivinen = 1) AS active_users
    `);

    const [unlocatedItems] = await db.execute(
      'SELECT COUNT(*) AS cnt FROM tavarat WHERE Hylly_id IS NULL AND Laatikko_id IS NULL'
    );

    res.json({
      items:            counts.total_items,
      warehouses:       counts.total_warehouses,
      cabinets:         counts.total_cabinets,
      shelves:          counts.total_shelves,
      boxes:            counts.total_boxes,
      productGroups:    counts.total_product_groups,
      activeUsers:      counts.active_users,
      reservations: {
        total:  counts.total_reservations,
        active: counts.active_reservations,
      },
      unlocatedItems: unlocatedItems[0].cnt,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/stats/warehouses
router.get('/warehouses', authenticate, async (_req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT
        v.ID,
        v.Varasto_nimi,
        COUNT(DISTINCT k.ID) AS cabinets,
        COUNT(DISTINCT h.ID) AS shelves,
        COUNT(DISTINCT t.ID) AS items
      FROM varastot v
      LEFT JOIN kaapit  k ON k.Varasto_id = v.ID
      LEFT JOIN hyllyt  h ON h.Kaappi_id  = k.ID
      LEFT JOIN tavarat t ON t.Hylly_id   = h.ID
      GROUP BY v.ID
      ORDER BY v.Varasto_nimi
    `);
    res.json(rows.map(r => ({
      id:       r.ID,
      name:     r.Varasto_nimi,
      cabinets: r.cabinets,
      shelves:  r.shelves,
      items:    r.items,
    })));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/stats/groups
router.get('/groups', authenticate, async (_req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT tr.ID, tr.Tuoteryhma, COUNT(t.ID) AS items
      FROM tuoteryhmat tr
      LEFT JOIN tavarat t ON t.Tuoteryhma_id = tr.ID
      GROUP BY tr.ID
      ORDER BY items DESC
    `);
    res.json(rows.map(r => ({ id: r.ID, name: r.Tuoteryhma, items: r.items })));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/stats/activity?days=30
router.get(
  '/activity',
  authenticate,
  [query('days').optional().isInt({ min: 1, max: 365 }).toInt()],
  validate,
  async (req, res) => {
    try {
      const days = req.query.days || 30;
      const [rows] = await db.execute(`
        SELECT
          DATE(Varaus_alku)  AS day,
          COUNT(*)           AS reservations_started,
          SUM(Varaus_loppu IS NOT NULL) AS returned
        FROM varaukset
        WHERE Varaus_alku >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        GROUP BY DATE(Varaus_alku)
        ORDER BY day ASC
      `, [days]);
      res.json(rows);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
  },
);

module.exports = router;
