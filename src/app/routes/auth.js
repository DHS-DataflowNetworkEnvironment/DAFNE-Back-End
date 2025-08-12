const router = require('express').Router();
const authConfig = require('app/controllers/auth');
const isAuth = require('app/auth/is-auth');

router.post('/token', authConfig.token); //Login: Returns token
router.post('/logout', authConfig.logout); //Logout
router.post('/is-auth', isAuth, authConfig.isAuth); //FE check if is auth
router.get('/check-admin-count', isAuth, authConfig.checkAdminCount); //FE check admin users count

module.exports = router;