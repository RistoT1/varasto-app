# Varasto API

Production-ready REST API for the Varasto inventory system — **Express.js + MySQL2 + MariaDB**.

---

## Quick start

```bash
cp .env.example .env          # fill in DB credentials and JWT_SECRET
npm install
node index.js
# API  → http://localhost:3000
# Docs → http://localhost:3000/docs
```

### With Docker Compose (recommended)

```bash
# Place your varasto.sql next to docker-compose.yml — it auto-imports on first run
docker compose up -d
# API  → http://localhost:3000
# Docs → http://localhost:3000/docs
```

---

## Interactive API documentation

Swagger UI is available at **`/docs`** after starting the server.  
Raw OpenAPI JSON is at **`/docs.json`**.

---

## Authentication

All endpoints require `Authorization: Bearer <token>` except:
- `POST /api/auth/login`
- `GET /health`

```
POST /api/auth/login
{ "username": "admin", "password": "secret" }
→ { token, user }
```

The login endpoint is rate-limited to **20 requests / 15 min per IP**.

---

## Full endpoint reference

### Auth `/api/auth`
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Login → JWT |
| GET  | `/api/auth/me`    | Current user from token |

---

### Items `/api/items`
| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/items`              | List. Filters: `tuoteryhma_id` `varasto_id` `kaappi_id` `hylly_id`. Pagination: `page` `limit`. Sort: `sort=id\|name\|tuoteryhma` `order=asc\|desc` |
| GET    | `/api/items/search?q=`    | Search name, tag, note |
| GET    | `/api/items/:id`          | Single item — full location chain |
| POST   | `/api/items`              | Create |
| PUT    | `/api/items/:id`          | Full replace |
| PATCH  | `/api/items/:id`          | Partial update |
| DELETE | `/api/items/:id`          | **Admin** |

Body fields: `name`, `note`, `tag`, `tuoteryhma_id`, `hylly_id`, `laatikko_id`

---

### Warehouses `/api/warehouses`
| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/warehouses`              | List with cabinet/shelf counts |
| GET    | `/api/warehouses/search?q=`    | Search by name |
| GET    | `/api/warehouses/:id`          | Single warehouse |
| GET    | `/api/warehouses/:id/cabinets` | Cabinets in warehouse |
| GET    | `/api/warehouses/:id/items`    | All items in warehouse (paginated) |
| POST   | `/api/warehouses`              | **Admin** |
| PUT    | `/api/warehouses/:id`          | **Admin** |
| DELETE | `/api/warehouses/:id`          | **Admin** |

---

### Cabinets `/api/cabinets`
| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/cabinets`              | List. Filter: `varasto_id` |
| GET    | `/api/cabinets/search?q=`    | Search by number |
| GET    | `/api/cabinets/:id`          | Single cabinet |
| GET    | `/api/cabinets/:id/shelves`  | Shelves in cabinet |
| POST   | `/api/cabinets`              | **Admin** — body: `{ number, varasto_id }` |
| PUT    | `/api/cabinets/:id`          | **Admin** |
| DELETE | `/api/cabinets/:id`          | **Admin** |

---

### Shelves `/api/shelves`
| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/shelves`             | List. Filter: `kaappi_id` |
| GET    | `/api/shelves/search?q=`   | Search by number |
| GET    | `/api/shelves/:id`         | Single shelf |
| GET    | `/api/shelves/:id/items`   | Items on shelf (paginated) |
| POST   | `/api/shelves`             | **Admin** — body: `{ number, kaappi_id }` |
| PUT    | `/api/shelves/:id`         | **Admin** |
| DELETE | `/api/shelves/:id`         | **Admin** |

---

### Product groups `/api/product-groups`
| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/product-groups`              | List with item counts |
| GET    | `/api/product-groups/search?q=`    | Search by name |
| GET    | `/api/product-groups/:id/items`    | Items in group (paginated) |
| POST   | `/api/product-groups`              | **Admin** |
| PUT    | `/api/product-groups/:id`          | **Admin** |
| DELETE | `/api/product-groups/:id`          | **Admin** |

---

### Boxes `/api/boxes`
| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/boxes`              | List with item counts |
| GET    | `/api/boxes/search?q=`    | Search by name |
| GET    | `/api/boxes/:id/items`    | Items in box (paginated) |
| POST   | `/api/boxes`              | **Admin** |
| PUT    | `/api/boxes/:id`          | **Admin** |
| DELETE | `/api/boxes/:id`          | **Admin** |

---

### Reservations `/api/reservations`
| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/reservations`               | List. Filters: `active=true\|false` `user_id` `item_id` `page` `limit` |
| GET    | `/api/reservations/:id`           | Single reservation |
| POST   | `/api/reservations`               | Create — body: `{ item_id, user_id? }` |
| PATCH  | `/api/reservations/:id/return`    | Mark returned (sets `Varaus_loppu = NOW()`) |
| DELETE | `/api/reservations/:id`           | **Admin** |

---

### Users `/api/users`
| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/users`                   | List — **Admin** |
| GET    | `/api/users/:id`               | Admin or self |
| POST   | `/api/users`                   | Create — **Admin** — body: `{ username, password, kayttolupa_id? }` |
| PATCH  | `/api/users/:id/password`      | Change password (self or admin) — body: `{ password }` |
| PATCH  | `/api/users/:id/status`        | Activate/deactivate — **Admin** — body: `{ active: true\|false }` |
| DELETE | `/api/users/:id`               | **Admin** |

---

### Roles `/api/roles`
| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/roles`      | List with user counts |
| GET    | `/api/roles/:id`  | Single role |
| POST   | `/api/roles`      | **Admin** — body: `{ name }` |
| PUT    | `/api/roles/:id`  | **Admin** |
| DELETE | `/api/roles/:id`  | **Admin** |

---

### Statistics `/api/stats`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/stats`              | Overall counts: items, warehouses, cabinets, shelves, reservations, users |
| GET | `/api/stats/warehouses`   | Item/shelf/cabinet count per warehouse |
| GET | `/api/stats/groups`       | Item count per product group |
| GET | `/api/stats/activity`     | Reservation activity per day. Query: `?days=30` |

---

### Import & Export `/api/import` `/api/export`

#### Export
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/export/items.csv`         | All items as CSV download |
| GET | `/api/export/items.json`        | All items as JSON download |
| GET | `/api/export/warehouses.json`   | Full warehouse → cabinet → shelf → item tree |
| GET | `/api/export/reservations.csv`  | All reservations as CSV — **Admin** |

#### Import (Admin only)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/import/items/csv`   | `multipart/form-data` with field `file` (CSV). Add `?create_locations=1` to auto-create missing warehouses/cabinets/shelves |
| POST | `/api/import/items/json`  | JSON array body. Same `?create_locations=1` option |

**CSV / JSON columns:** `name` (required), `note`, `tag`, `product_group`, `warehouse`, `cabinet`, `shelf`, `box`

Import uses **upsert by name** — existing items are updated, new ones are inserted.

Response:
```json
{ "inserted": 12, "updated": 3, "errors": [{ "row": 5, "name": "Bad Item", "error": "..." }] }
```

---

### Health
```
GET /health  →  { "status": "ok", "ts": "...", "version": "1.0.0" }
```

---

## HTTP status codes

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 204 | Deleted (no body) |
| 400 | Bad request / invalid file |
| 401 | Missing or invalid token |
| 403 | Insufficient permissions |
| 404 | Resource not found |
| 409 | Duplicate (unique constraint violation) |
| 422 | Validation error → `{ errors: [...] }` |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | HTTP port |
| `NODE_ENV` | development | `development` or `production` |
| `DB_HOST` | localhost | MariaDB/MySQL host |
| `DB_PORT` | 3306 | MariaDB/MySQL port |
| `DB_USER` | root | DB username |
| `DB_PASSWORD` | — | DB password |
| `DB_NAME` | varasto | Database name |
| `DB_POOL_LIMIT` | 10 | Connection pool size |
| `JWT_SECRET` | **required** | Long random string |
| `JWT_EXPIRES_IN` | 8h | Token lifetime (e.g. `1h`, `8h`, `7d`) |
| `RATE_LIMIT_MAX` | 200 | Requests per 15 min window |

Generate a strong JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
