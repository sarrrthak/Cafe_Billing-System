/* ============================================================
   routes/invoices.js — Invoice Routes  (all protected)
   GET    /api/invoices             list (filter, sort, paginate)
   GET    /api/invoices/stats       dashboard analytics
   GET    /api/invoices/:id         single with items
   POST   /api/invoices             create
   PATCH  /api/invoices/:id/status  update status
   DELETE /api/invoices/:id         delete
   ============================================================ */
const router = require('express').Router();
const ctrl   = require('../controllers/invoiceController');
const auth   = require('../middleware/auth');

router.use(auth);

router.get   ('/',              ctrl.getAll);
router.get   ('/stats',         ctrl.getStats);
router.get   ('/:id',           ctrl.getOne);
router.post  ('/',              ctrl.create);
router.patch ('/:id/status',    ctrl.updateStatus);
router.delete('/:id',           ctrl.delete);

module.exports = router;
