const controller = require('../controllers/' + 'products');
const router = require('express').Router();
const isAuth = require('../auth/is-auth');

/** CRUD OPERATIONS */

//Compute completeness -> [POST] ../products/completeness
router.post('/completeness', isAuth, controller.computeCompleteness);

module.exports = router;
