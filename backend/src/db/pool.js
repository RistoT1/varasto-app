const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:              process.env.DB_HOST     || 'localhost',
  port:              parseInt(process.env.DB_PORT || '3306'),
  user:              process.env.DB_USER     || 'root',
  password:          process.env.DB_PASSWORD || '',
  database:          process.env.DB_NAME     || 'varasto',
  connectionLimit:   parseInt(process.env.DB_CONNECTION_LIMIT || '10'),
  waitForConnections: true,
  queueLimit:        0,
  timezone:          '+00:00',
  charset:           'utf8mb4',
});

// Verify connectivity on startup
pool.getConnection()
  .then(conn => {
    console.log('✅  Database connected');
    conn.release();
  })
  .catch(err => {
    console.error('❌  Database connection failed:', err.message);
    process.exit(1);
  });

module.exports = pool;
