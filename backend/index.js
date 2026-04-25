'use strict';

require('dotenv').config();

const express       = require('express');
const helmet        = require('helmet');
const morgan        = require('morgan');
const cors          = require('cors');
const compression   = require('compression');
const swaggerUi     = require('swagger-ui-express');
const swaggerSpec   = require('./src/config/swagger');
const path          = require('path');

// ── Route modules ─────────────────────────────────────────────────────────
const authRouter         = require('./src/routes/auth');
const itemsRouter        = require('./src/routes/items');
const warehousesRouter   = require('./src/routes/warehouses');
const { cabinets, shelves } = require('./src/routes/locations');
const { productGroups, boxes } = require('./src/routes/catalog');
const reservationsRouter = require('./src/routes/reservations');
const usersRouter        = require('./src/routes/users');
const rolesRouter        = require('./src/routes/roles');
const statsRouter        = require('./src/routes/stats');
const importExportRouter = require('./src/routes/importexport');
const searchRouter       = require('./src/routes/search');
const { globalLimiter, authLimiter } = require('./src/middleware/rateLimiters');
const cookieParser       = require('cookie-parser');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Security & utility middleware ─────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "data:"],
      upgradeInsecureRequests: null,  
    }
  }
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || 'http://localhost:5173',
  credentials: true
}))
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use('/api', globalLimiter);
app.use('/api/auth', authLimiter);
app.use(cookieParser());

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'public')));
}

// ── Swagger UI ────────────────────────────────────────────────────────────
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Varasto API Docs',
  swaggerOptions: { persistAuthorization: true },
}));
app.get('/docs.json', (_req, res) => res.json(swaggerSpec));

// ── API routes ────────────────────────────────────────────────────────────
app.use('/api/auth',           authRouter);
app.use('/api/search',         searchRouter);
app.use('/api/items',          itemsRouter);
app.use('/api/warehouses',     warehousesRouter);
app.use('/api/cabinets',       cabinets);
app.use('/api/shelves',        shelves);
app.use('/api/product-groups', productGroups);
app.use('/api/boxes',          boxes);
app.use('/api/reservations',   reservationsRouter);
app.use('/api/users',          usersRouter);
app.use('/api/roles',          rolesRouter);
app.use('/api/stats',          statsRouter);
app.use('/api/export',         importExportRouter);
app.use('/api/import',         importExportRouter);

// ── Health check (no auth) ────────────────────────────────────────────────
app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', ts: new Date().toISOString(), version: '1.0.0' })
);

// ── Serve Vue frontend in production ──────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  app.get('/{*path}', (_req, res) =>
    res.sendFile(path.join(__dirname, 'public', 'index.html'))
  );
}

// ── 404 fallback ──────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ── Global error handler ──────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀  Varasto API  →  http://localhost:${PORT}`);
    console.log(`📖  Swagger UI   →  http://localhost:${PORT}/docs`);
  });
}

module.exports = app;