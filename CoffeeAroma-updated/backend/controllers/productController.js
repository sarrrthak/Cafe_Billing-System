/* ============================================================
   controllers/productController.js — Menu Item CRUD
   ============================================================ */
const db = require('../config/db');
const { validateRequired, validatePositive } = require('../middleware/errorHandler');

/* ---------- GET ALL ---------- */
exports.getAll = async (req, res, next) => {
  try {
    const { category, search, active } = req.query;
    let sql    = 'SELECT * FROM products WHERE user_id = $1';
    const params = [req.user.id];
    let idx = 2;

    if (active !== 'false') { sql += ` AND is_active = TRUE`; }
    if (category) { sql += ` AND category ILIKE $${idx++}`; params.push(category); }
    if (search)   { sql += ` AND (name ILIKE $${idx} OR category ILIKE $${idx})`; params.push(`%${search}%`); idx++; }

    sql += ' ORDER BY category, name';
    const result = await db.query(sql, params);
    res.json({ success:true, data: result.rows, count: result.rowCount });
  } catch (err) { next(err); }
};

/* ---------- GET ONE ---------- */
exports.getOne = async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM products WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ success:false, message:'Product not found' });
    res.json({ success:true, data: result.rows[0] });
  } catch (err) { next(err); }
};

/* ---------- CREATE ---------- */
exports.create = async (req, res, next) => {
  try {
    const { name, category, price, taxRate, unit, emoji, description } = req.body;
    validateRequired(['name','price'], req.body);
    validatePositive(['price'], req.body);

    const result = await db.query(
      `INSERT INTO products (user_id, name, category, price, tax_rate, unit, emoji, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user.id, name.trim(), (category||'General').trim(),
       parseFloat(price), parseFloat(taxRate)||5,
       (unit||'plate'), (emoji||'🍽️'), (description||'').trim()]
    );
    res.status(201).json({ success:true, message:'Menu item added', data: result.rows[0] });
  } catch (err) { next(err); }
};

/* ---------- UPDATE ---------- */
exports.update = async (req, res, next) => {
  try {
    // Verify ownership
    const check = await db.query('SELECT id FROM products WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    if (!check.rows.length) return res.status(404).json({ success:false, message:'Product not found' });

    const { name, category, price, taxRate, unit, emoji, description, isActive } = req.body;
    const result = await db.query(
      `UPDATE products SET
         name=$1, category=$2, price=$3, tax_rate=$4, unit=$5,
         emoji=$6, description=$7, is_active=$8
       WHERE id=$9 AND user_id=$10 RETURNING *`,
      [name, category||'General', parseFloat(price), parseFloat(taxRate)||5,
       unit||'plate', emoji||'🍽️', description||'',
       isActive !== false, req.params.id, req.user.id]
    );
    res.json({ success:true, message:'Menu item updated', data: result.rows[0] });
  } catch (err) { next(err); }
};

/* ---------- DELETE ---------- */
exports.delete = async (req, res, next) => {
  try {
    const check = await db.query('SELECT id FROM products WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    if (!check.rows.length) return res.status(404).json({ success:false, message:'Product not found' });

    // Soft-delete (preserve invoice history)
    await db.query('UPDATE products SET is_active=FALSE WHERE id=$1', [req.params.id]);
    res.json({ success:true, message:'Menu item removed' });
  } catch (err) { next(err); }
};

/* ---------- GET CATEGORIES ---------- */
exports.getCategories = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT DISTINCT category, COUNT(*) as count
       FROM products WHERE user_id=$1 AND is_active=TRUE
       GROUP BY category ORDER BY category`,
      [req.user.id]
    );
    res.json({ success:true, data: result.rows });
  } catch (err) { next(err); }
};
