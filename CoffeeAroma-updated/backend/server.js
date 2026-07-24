/* ============================================================
   server.js — Cafe Aroma Restaurant Backend
   Express + PostgreSQL API Server
   ============================================================ */
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app  = express();
const PORT = process.env.PORT || 5000;



app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

/* ---- Body Parsing ---- */
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

/* ---- Request Logger (dev) ---- */
if (process.env.NODE_ENV === 'development') {
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

/* ---- Health Check ---- */
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'Cafe Aroma API', time: new Date().toISOString() });
});

/* ---- API Routes ---- */
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/invoices', require('./routes/invoices'));

/* ---- 404 & Error Handlers ---- */
app.use(notFound);
app.use(errorHandler);

/* ---- Start ---- */
app.listen(PORT, () => {
  console.log(`\n🚀  Cafe Aroma API running on http://localhost:${PORT}`);
  console.log(`📋  Health: http://localhost:${PORT}/health`);
  console.log(`🗄️   Env: ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;
