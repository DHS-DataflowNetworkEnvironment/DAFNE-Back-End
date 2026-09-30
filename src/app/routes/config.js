const router = require('express').Router();
const controller = require('app/controllers/config');
const isAuth = require('app/auth/is-auth');

router.get('/availability/rollingPeriodInDays', isAuth, controller.availabilityRollingPeriod); 
router.get('/timeliness/rollingPeriodInDays', isAuth, controller.timelinessRollingPeriod); 
router.get('/auth/clientId', isAuth, controller.clientId); 

module.exports = router;