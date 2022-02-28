const controller = require('../controllers/' + 'centres');
const router = require('express').Router();
const isAuth = require('../auth/is-auth');
const isAdmin = require('../auth/is-admin');

/** CRUD OPERATIONS */
//READ ALL CENTRES -> [GET] ../centres
router.get('/', isAuth, controller.getAll);

//READ ONE CENTRE -> [GET] ../centres/id
router.get('/:id', isAuth, controller.getOne);

//CREATE ONE CENTRE -> [POST] ../centres
router.post('/', isAuth, isAdmin, controller.createOne);

//UPDATE ONE CENTRE -> [PUT] ../centres/id
router.put('/:id', isAuth, isAdmin, controller.updateOne);

//DELETE ONE CENTRE -> [DELETE] ../centres/id
router.delete('/:id', isAuth, isAdmin, controller.deleteOne);

//READ ONE CENTRE Rolling info -> [GET] ../centres/id/rolling
router.get('/:id/rolling', isAuth, controller.getRolling);

//READ ONE CENTRE Archive Info -> [GET] ../centres/id/datasourcesinfo
router.get('/:id/datasourcesinfo', isAuth, controller.getDataSourcesInfo);

//[GET] ../centres/id/map/datasourcesinfo
router.get('/:id/map/datasourcesinfo', isAuth, controller.getMapDataSourcesInfo);

//[GET] ../centres/id/map/dhsconnected
router.get('/:id/map/dhsconnected', isAuth, controller.getMapDhsConnected);
module.exports = router;

//[POST] ../centres/id/service/availability
router.post('/:id/service/availability', isAuth, controller.computeAvailability);
module.exports = router;

//[POST] ../centres/id/service/availability/average
router.post('/:id/service/availability/average', isAuth, controller.computeAverageAvailability);
module.exports = router;
