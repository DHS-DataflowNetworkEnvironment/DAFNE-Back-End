const controller = require('../controllers/' + 'synchronizers');
const router = require('express').Router();
const isAuth = require('../auth/is-auth');
const isAdmin = require('../auth/is-admin');

/** CRUD OPERATIONS */
//READ ALL Synchronizers -> [GET] ../synchronizers
router.get('/', isAuth, controller.getAll);

//READ ALL FE Synchronizers -> [GET] ../synchronizers/fe
router.get('/fe', isAuth, controller.getAllV2FE);

//READ ALL BE Synchronizers -> [GET] ../synchronizers/be
router.get('/be', isAuth, controller.getAllV2BE);

//READ ALL SI Synchronizers -> [GET] ../synchronizers/si
router.get('/si', isAuth, controller.getAllV2SI);

//CREATE ONE Synchronizer -> [POST] ../synchronizers
router.post('/', isAuth, isAdmin, controller.createOne);

router.put('/:id', isAuth, isAdmin, controller.updateOne);

//DELETE ONE Synchronizer -> [DELETE] ../Synchronizer/id
router.delete('/:id', isAuth, isAdmin, controller.deleteOne);

//READ ALL Synchronizers V2-> [GET] ../synchronizers/v2
router.get('/v2', isAuth, controller.getAllV2);

module.exports = router;
