/* ============================================================
   routes/auth.js — Authentication Routes
   POST /api/auth/register
   POST /api/auth/login
   GET  /api/auth/profile      (protected)
   PUT  /api/auth/profile      (protected)
   PUT  /api/auth/password     (protected)
   ============================================================ */
const router  = require('express').Router();
const ctrl    = require('../controllers/authController');
const auth    = require('../middleware/auth');

router.post('/register',        ctrl.register);
router.post('/login',           ctrl.login);
router.get ('/profile', auth,   ctrl.getProfile);
router.put ('/profile', auth,   ctrl.updateProfile);
router.put ('/password', auth,  ctrl.changePassword);

module.exports = router;
