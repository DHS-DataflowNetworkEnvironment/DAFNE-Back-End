const controller = require('../controllers/' + 'synchronizers');
const router = require('express').Router();
const isAuth = require('../auth/is-auth');
const isAdmin = require('../auth/is-admin');

/** CRUD OPERATIONS */
//READ ALL Synchronizers -> [GET] ../synchronizers
router.get('/', isAuth, controller.getAll);

//CREATE ONE Synchronizer -> [POST] ../synchronizers
router.post('/', isAuth, isAdmin, controller.createOne);

router.put('/:id', isAuth, isAdmin, controller.updateOne);

//DELETE ONE Synchronizer -> [DELETE] ../Synchronizer/id
router.delete('/:id', isAuth, isAdmin, controller.deleteOne);

//READ ALL Synchronizers V2-> [GET] ../synchronizers/v2
router.get('/v2', isAuth, controller.getAllV2);

module.exports = router;
