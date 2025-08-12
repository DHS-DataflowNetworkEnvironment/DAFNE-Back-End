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

//Get Synchronizers List -> [GET] ../services/id/synchronizers
router.get('/:id/synchronizers', isAuth, controller.getSynchronizers);

//Get Intelligent Synchronizers support -> [GET] ../services/id/synchronizers/intelligentSyncSupport
router.get('/:id/synchronizers/intelligentSyncSupport', isAuth, controller.geIntelligentSyncSupport);

module.exports = router;
