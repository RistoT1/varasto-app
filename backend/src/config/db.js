'use strict';

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT) || 3306,
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'varasto',
  waitForConnections: true,
  connectionLimit:    Number(process.env.DB_POOL_LIMIT) || 10,
  queueLimit:         0,
  timezone:           'Z',
  charset:            'utf8mb4',
});

// Verify the pool on startup
pool.getConnection()
  .then(conn => { conn.release(); console.log('✅  Database pool ready'); })
  .catch(err  => { console.error('❌  Database connection failed:', err.message); process.exit(1); });

module.exports = pool;
