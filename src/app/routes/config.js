const controller = require('../controllers/config');
const router = require('express').Router();
const isAuth = require('../auth/is-auth');

router.get('/availability/rollingPeriodInDays', isAuth, controller.availabilityRollingPeriod); 
router.get('/latency/rollingPeriodInDays', isAuth, controller.latencyRollingPeriod); 

module.exports = router;