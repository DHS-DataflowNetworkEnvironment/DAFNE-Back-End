const controller = require('../controllers/auth');
const router = require('express').Router();

router.post('/token', controller.token); //Login: Returns token
router.post('/logout', controller.logout); //Logout

module.exports = router;