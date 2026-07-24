/* ============================================================
   controllers/authController.js
   ============================================================ */
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const db     = require('../config/db');
const { validateEmail, validateRequired } = require('../middleware/errorHandler');

/* ---------- helpers ---------- */
function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, businessName: user.business_name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}
function safeUser(u) {
  return {
    id:           u.id,
    firstName:    u.first_name,
    lastName:     u.last_name,
    email:        u.email,
    businessName: u.business_name,
    createdAt:    u.created_at,
  };
}

/* ---------- REGISTER ---------- */
exports.register = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, businessName } = req.body;
    validateRequired(['firstName','email','password'], req.body);

    if (!validateEmail(email)) return res.status(400).json({ success:false, message:'Invalid email address' });
    if (password.length < 8)   return res.status(400).json({ success:false, message:'Password must be at least 8 characters' });

    const exists = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (exists.rows.length) return res.status(409).json({ success:false, message:'Email already registered' });

    const hash    = await bcrypt.hash(password, 10);
    const userRes = await db.query(
      `INSERT INTO users (first_name, last_name, email, password_hash, business_name)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [firstName.trim(), (lastName||'').trim(), email.toLowerCase(), hash, (businessName||'My Restaurant').trim()]
    );
    const user = userRes.rows[0];

    // Create invoice sequence for new user
    await db.query('INSERT INTO invoice_sequences (user_id, next_seq) VALUES ($1, 1)', [user.id]);

    const token = signToken(user);
    res.status(201).json({ success:true, message:'Account created', token, user: safeUser(user) });
  } catch (err) { next(err); }
};

/* ---------- LOGIN ---------- */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    validateRequired(['email','password'], req.body);

    const result = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    if (!result.rows.length) return res.status(401).json({ success:false, message:'Invalid email or password' });

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ success:false, message:'Invalid email or password' });

    const token = signToken(user);
    res.json({ success:true, message:'Login successful', token, user: safeUser(user) });
  } catch (err) { next(err); }
};

/* ---------- GET PROFILE ---------- */
exports.getProfile = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (!result.rows.length) return res.status(404).json({ success:false, message:'User not found' });
    res.json({ success:true, user: safeUser(result.rows[0]) });
  } catch (err) { next(err); }
};

/* ---------- UPDATE PROFILE ---------- */
exports.updateProfile = async (req, res, next) => {
  try {
    const { firstName, lastName, businessName } = req.body;
    const result = await db.query(
      `UPDATE users SET first_name=$1, last_name=$2, business_name=$3 WHERE id=$4 RETURNING *`,
      [firstName||req.user.firstName, lastName||req.user.lastName, businessName||req.user.businessName, req.user.id]
    );
    res.json({ success:true, message:'Profile updated', user: safeUser(result.rows[0]) });
  } catch (err) { next(err); }
};

/* ---------- CHANGE PASSWORD ---------- */
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    validateRequired(['currentPassword','newPassword'], req.body);
    if (newPassword.length < 8) return res.status(400).json({ success:false, message:'New password must be at least 8 characters' });

    const result = await db.query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
    const match  = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!match) return res.status(401).json({ success:false, message:'Current password is incorrect' });

    const hash = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.user.id]);
    res.json({ success:true, message:'Password changed successfully' });
  } catch (err) { next(err); }
};
