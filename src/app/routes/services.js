const router = require('express').Router();
const controller = require('app/controllers/services');
const isAuth = require('app/auth/is-auth');
const isAdmin = require('app/auth/is-admin');

/** CRUD OPERATIONS */
//READ ALL USERS -> [GET] ../services
router.get('/', isAuth, controller.getAll);

//READ ONE USER -> [GET] ../services/id
router.get('/:id', isAuth, isAdmin, controller.getOne);

//CREATE ONE USER -> [POST] ../services
router.post('/', isAuth, isAdmin, controller.createOne);

//UPDATE ONE USER -> [PUT] ../services/id
router.put('/:id', isAuth, isAdmin, controller.updateOne);

//DELETE ONE USER -> [DELETE] ../services/id
router.delete('/:id', isAuth, isAdmin, controller.deleteOne);

module.exports = router;
