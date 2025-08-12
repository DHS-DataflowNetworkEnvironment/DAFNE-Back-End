const router = require('express').Router();
const controller = require('app/controllers/products');
const isAuth = require('app/auth/is-auth');

/** CRUD OPERATIONS */

//Compute completeness -> [POST] ../products/completeness
router.post('/completeness', isAuth, controller.computeCompleteness);

//Compute completeness from sync filter -> [POST] ../products/completeness
router.post('/filter-completeness', isAuth, controller.computeFilterCompleteness);

module.exports = router;
