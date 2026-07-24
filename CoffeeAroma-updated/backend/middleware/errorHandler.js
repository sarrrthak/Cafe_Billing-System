/* ============================================================
   middleware/errorHandler.js — Centralized error handling
   ============================================================ */

// 404 handler
function notFound(req, res, next) {
  const err = new Error(`Route not found: ${req.originalUrl}`);
  err.status = 404;
  next(err);
}

// Global error handler
function errorHandler(err, req, res, next) {
  const status  = err.status || 500;
  const message = err.message || 'Internal Server Error';

  if (process.env.NODE_ENV === 'development') {
    console.error(`[ERROR] ${status} — ${message}`);
    if (status === 500) console.error(err.stack);
  }

  // PostgreSQL unique violation
  if (err.code === '23505') {
    return res.status(409).json({ success: false, message: 'A record with this value already exists.' });
  }
  // PostgreSQL foreign key violation
  if (err.code === '23503') {
    return res.status(400).json({ success: false, message: 'Referenced record does not exist.' });
  }

  res.status(status).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

/* ---- Input validators ---- */

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateRequired(fields, body) {
  const missing = fields.filter(f => !body[f] && body[f] !== 0);
  if (missing.length) {
    const err = new Error(`Missing required fields: ${missing.join(', ')}`);
    err.status = 400;
    throw err;
  }
}

function validatePositive(fields, body) {
  for (const f of fields) {
    if (isNaN(parseFloat(body[f])) || parseFloat(body[f]) < 0) {
      const err = new Error(`${f} must be a non-negative number`);
      err.status = 400;
      throw err;
    }
  }
}

module.exports = { notFound, errorHandler, validateEmail, validateRequired, validatePositive };
