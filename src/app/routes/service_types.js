const controller = require('../controllers/' + 'service_types');
const router = require('express').Router();
const isAuth = require('../auth/is-auth');
const isAdmin = require('../auth/is-admin');

/** CRUD OPERATIONS */
//READ ALL USERS -> [GET] ../servicetypes
router.get('/', isAuth, controller.getAll);

//READ ONE USER -> [GET] ../servicetypes/id
router.get('/:id', isAuth, controller.getOne);

//CREATE ONE USER -> [POST] ../servicetypes
router.post('/', isAuth, isAdmin, controller.createOne);

//UPDATE ONE USER -> [PUT] ../servicetypes/id
router.put('/:id', isAuth, isAdmin, controller.updateOne);

//DELETE ONE USER -> [DELETE] ../servicetypes/id
router.delete('/:id', isAuth, isAdmin, controller.deleteOne);

module.exports = router;
