'use strict';

/**
 * Unified search endpoint
 *
 * GET /api/search?q=...&limit=...
 *
 * Returns results bucketed by entity type:
 *   items, warehouses, cabinets, shelves, boxes, productGroups
 *
 * Each bucket: { total: N, data: [...] }
 * Overall response also includes:
 *   query: string
 *   total: N  (sum across all buckets)
 */

const router = require('express').Router();
const { query } = require('express-validator');
const db = require('../config/db');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');

// ─── helpers ────────────────────────────────────────────────────────────────

const ITEM_SELECT = `
  SELECT
    t.ID,
    t.Nimi,
    t.Huom,
    t.Tunniste,
    tr.ID   AS tuoteryhma_id,
    tr.Tuoteryhma,
    h.ID    AS hylly_id,
    h.Hylly_numero,
    k.ID    AS kaappi_id,
    k.Kaappi_numero,
    v.ID    AS varasto_id,
    v.Varasto_nimi,
    la.ID   AS laatikko_id,
    la.Laatikko_nimi
  FROM tavarat t
  LEFT JOIN tuoteryhmat  tr ON tr.ID = t.Tuoteryhma_id
  LEFT JOIN hyllyt        h ON h.ID  = t.Hylly_id
  LEFT JOIN kaapit        k ON k.ID  = h.Kaappi_id
  LEFT JOIN varastot      v ON v.ID  = k.Varasto_id
  LEFT JOIN laatikot     la ON la.ID = t.Laatikko_id
`;

function buildItem(row) {
  return {
    id:   row.ID,
    name: row.Nimi,
    note: row.Huom,
    tag:  row.Tunniste,
    productGroup: row.tuoteryhma_id
      ? { id: row.tuoteryhma_id, name: row.Tuoteryhma }
      : null,
    shelf: row.hylly_id
      ? {
          id:     row.hylly_id,
          number: row.Hylly_numero,
          cabinet: row.kaappi_id
            ? {
                id:     row.kaappi_id,
                number: row.Kaappi_numero,
                warehouse: row.varasto_id
                  ? { id: row.varasto_id, name: row.Varasto_nimi }
                  : null,
              }
            : null,
        }
      : null,
    box: row.laatikko_id
      ? { id: row.laatikko_id, name: row.Laatikko_nimi }
      : null,
  };
}

// ─── GET /api/search ─────────────────────────────────────────────────────────

router.get(
  '/',
  authenticate,
  [
    query('q').trim().notEmpty().withMessage('q is required'),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  validate,
  async (req, res) => {
    try {
      const raw   = req.query.q;
      const limit = req.query.limit || 20;
      const like  = `%${raw}%`;

      // Fan out all queries in parallel
      const [
        itemRows,
        itemCountRows,
        warehouseRows,
        warehouseCountRows,
        cabinetRows,
        cabinetCountRows,
        shelfRows,
        shelfCountRows,
        boxRows,
        boxCountRows,
        groupRows,
        groupCountRows,
      ] = await Promise.all([

        // Items — search name, tag, note, product-group name
        db.execute(
          `${ITEM_SELECT}
           WHERE t.Nimi LIKE ? OR t.Tunniste LIKE ? OR t.Huom LIKE ? OR tr.Tuoteryhma LIKE ?
           ORDER BY t.Nimi ASC LIMIT ?`,
          [like, like, like, like, limit],
        ).then(([rows]) => rows),

        db.execute(
          `SELECT COUNT(*) AS total
           FROM tavarat t
           LEFT JOIN tuoteryhmat tr ON tr.ID = t.Tuoteryhma_id
           WHERE t.Nimi LIKE ? OR t.Tunniste LIKE ? OR t.Huom LIKE ? OR tr.Tuoteryhma LIKE ?`,
          [like, like, like, like],
        ).then(([[row]]) => row.total),

        // Warehouses
        db.execute(
          `SELECT ID, Varasto_nimi AS name FROM varastot
           WHERE Varasto_nimi LIKE ? ORDER BY Varasto_nimi ASC LIMIT ?`,
          [like, limit],
        ).then(([rows]) => rows),

        db.execute(
          `SELECT COUNT(*) AS total FROM varastot WHERE Varasto_nimi LIKE ?`,
          [like],
        ).then(([[row]]) => row.total),

        // Cabinets (with warehouse name for context)
        db.execute(
          `SELECT k.ID, k.Kaappi_numero AS number, v.ID AS warehouse_id, v.Varasto_nimi AS warehouse_name
           FROM kaapit k
           LEFT JOIN varastot v ON v.ID = k.Varasto_id
           WHERE k.Kaappi_numero LIKE ?
           ORDER BY k.Kaappi_numero ASC LIMIT ?`,
          [like, limit],
        ).then(([rows]) => rows),

        db.execute(
          `SELECT COUNT(*) AS total FROM kaapit WHERE Kaappi_numero LIKE ?`,
          [like],
        ).then(([[row]]) => row.total),

        // Shelves (with cabinet + warehouse for context)
        db.execute(
          `SELECT h.ID, h.Hylly_numero AS number,
                  k.ID AS cabinet_id, k.Kaappi_numero AS cabinet_number,
                  v.ID AS warehouse_id, v.Varasto_nimi AS warehouse_name
           FROM hyllyt h
           LEFT JOIN kaapit  k ON k.ID = h.Kaappi_id
           LEFT JOIN varastot v ON v.ID = k.Varasto_id
           WHERE h.Hylly_numero LIKE ?
           ORDER BY h.Hylly_numero ASC LIMIT ?`,
          [like, limit],
        ).then(([rows]) => rows),

        db.execute(
          `SELECT COUNT(*) AS total FROM hyllyt WHERE Hylly_numero LIKE ?`,
          [like],
        ).then(([[row]]) => row.total),

        // Boxes
        db.execute(
          `SELECT ID, Laatikko_nimi AS name FROM laatikot
           WHERE Laatikko_nimi LIKE ? ORDER BY Laatikko_nimi ASC LIMIT ?`,
          [like, limit],
        ).then(([rows]) => rows),

        db.execute(
          `SELECT COUNT(*) AS total FROM laatikot WHERE Laatikko_nimi LIKE ?`,
          [like],
        ).then(([[row]]) => row.total),

        // Product groups
        db.execute(
          `SELECT ID, Tuoteryhma AS name FROM tuoteryhmat
           WHERE Tuoteryhma LIKE ? ORDER BY Tuoteryhma ASC LIMIT ?`,
          [like, limit],
        ).then(([rows]) => rows),

        db.execute(
          `SELECT COUNT(*) AS total FROM tuoteryhmat WHERE Tuoteryhma LIKE ?`,
          [like],
        ).then(([[row]]) => row.total),
      ]);

      const buckets = {
        items: {
          total: itemCountRows,
          data:  itemRows.map(buildItem),
        },
        warehouses: {
          total: warehouseCountRows,
          data:  warehouseRows.map(r => ({ id: r.ID, name: r.name })),
        },
        cabinets: {
          total: cabinetCountRows,
          data:  cabinetRows.map(r => ({
            id:     r.ID,
            number: r.number,
            warehouse: r.warehouse_id
              ? { id: r.warehouse_id, name: r.warehouse_name }
              : null,
          })),
        },
        shelves: {
          total: shelfCountRows,
          data:  shelfRows.map(r => ({
            id:     r.ID,
            number: r.number,
            cabinet: r.cabinet_id
              ? {
                  id:     r.cabinet_id,
                  number: r.cabinet_number,
                  warehouse: r.warehouse_id
                    ? { id: r.warehouse_id, name: r.warehouse_name }
                    : null,
                }
              : null,
          })),
        },
        boxes: {
          total: boxCountRows,
          data:  boxRows.map(r => ({ id: r.ID, name: r.name })),
        },
        productGroups: {
          total: groupCountRows,
          data:  groupRows.map(r => ({ id: r.ID, name: r.name })),
        },
      };

      const total = Object.values(buckets).reduce((sum, b) => sum + b.total, 0);

      res.json({ query: raw, total, ...buckets });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

module.exports = router;