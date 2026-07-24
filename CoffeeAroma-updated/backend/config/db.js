/* ============================================================
   config/db.js — PostgreSQL connection pool
   ============================================================ */
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'billflow_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',

  ssl: {
    rejectUnauthorized: false,
  },

  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});

// Helper: run a query
async function query(text, params) {
  const start  = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DB] ${duration}ms — ${text.slice(0, 80)}`);
  }
  return result;
}

// Helper: get a client for transactions
async function getClient() {
  const client = await pool.connect();
  const originalQuery = client.query.bind(client);
  client.query = (...args) => {
    client.lastQuery = args;
    return originalQuery(...args);
  };
  const timeout = setTimeout(() => {
    console.error('Client checkout > 5s. Last query:', client.lastQuery);
  }, 5000);
  const release = client.release.bind(client);
  client.release = () => { clearTimeout(timeout); client.release = release; return release(); };
  return client;
}

module.exports = { query, getClient, pool };
