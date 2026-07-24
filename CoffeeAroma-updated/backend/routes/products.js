/* ============================================================
   routes/products.js — Menu Item Routes  (all protected)
   GET    /api/products             list (filter: category, search)
   GET    /api/products/categories  unique categories
   GET    /api/products/:id         single
   POST   /api/products             create
   PUT    /api/products/:id         update
   DELETE /api/products/:id         soft-delete
   ============================================================ */
const router = require('express').Router();
const ctrl   = require('../controllers/productController');
const auth   = require('../middleware/auth');

router.use(auth);   // all routes require login

router.get ('/',            ctrl.getAll);
router.get ('/categories',  ctrl.getCategories);
router.get ('/:id',         ctrl.getOne);
router.post('/',            ctrl.create);
router.put ('/:id',         ctrl.update);
router.delete('/:id',       ctrl.delete);

module.exports = router;
