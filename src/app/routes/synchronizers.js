const router = require('express').Router();
const controller = require('app/controllers/synchronizers');
const isAuth = require('app/auth/is-auth');
const isAdmin = require('app/auth/is-admin');

/** CRUD OPERATIONS */
//READ ALL Synchronizers -> [GET] ../synchronizers
router.get('/', isAuth, controller.getAll);

//READ ALL FE Synchronizers -> [GET] ../synchronizers/fe
router.get('/fe', isAuth, controller.getAllFE);

//READ ALL BE Synchronizers -> [GET] ../synchronizers/be
router.get('/be', isAuth, controller.getAllBE);

//READ ALL SI Synchronizers -> [GET] ../synchronizers/si
router.get('/si', isAuth, controller.getAllSI);

//CREATE ONE Synchronizer -> [POST] ../synchronizers
router.post('/', isAuth, isAdmin, controller.createOne);

router.put('/:id', isAuth, isAdmin, controller.updateOne);

//DELETE ONE Synchronizer -> [DELETE] ../Synchronizer/id
router.delete('/:id', isAuth, isAdmin, controller.deleteOne);

//READ ALL Synchronizers V2-> [GET] ../synchronizers/v2
router.get('/v2', isAuth, controller.getAllV2);

//READ ALL FE Synchronizers V2-> [GET] ../synchronizers/v2fe
router.get('/v2fe', isAuth, controller.getAllV2FE);

//READ ALL BE Synchronizers V2-> [GET] ../synchronizers/v2be
router.get('/v2be', isAuth, controller.getAllV2BE);

//READ ALL SI Synchronizers V2-> [GET] ../synchronizers/v2si
router.get('/v2si', isAuth, controller.getAllV2SI);

module.exports = router;
