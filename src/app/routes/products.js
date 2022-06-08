const controller = require('../controllers/' + 'products');
const router = require('express').Router();
const isAuth = require('../auth/is-auth');

/** CRUD OPERATIONS */

//Compute completeness -> [POST] ../products/completeness
router.post('/completeness', isAuth, controller.computeCompleteness);

//Compute completeness from sync filter -> [POST] ../products/completeness
router.post('/filter-completeness', isAuth, controller.computeFilterCompleteness);

module.exports = router;
