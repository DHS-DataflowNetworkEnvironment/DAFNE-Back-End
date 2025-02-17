const qs = require('qs')
const https = require('https')
const axios = require('axios');
const wlogger = require('../util/wlogger');
const conf = require('../util/config');
const jwt = require('jsonwebtoken');

/** [POST] /auth/token
 *  @param {string} req.body.username username
 *  @param {string} req.body.password password
 */
exports.token = async (req, res) => {
  try {
    //Register user model
    const KEYCLOAK_TOKEN_URL = conf.getTokenUrl();
    wlogger.info(KEYCLOAK_TOKEN_URL);
    const clientId = conf.getConfig().auth.clientId;
    const grantType = conf.getConfig().auth.grantType;
    const requestTimeout = (conf.getConfig().requestTimeout) ? conf.getConfig().requestTimeout : 30000;
    try {
      wlogger.info(`User login attempt`);
      const source = axios.CancelToken.source();
							
      let timeout = setTimeout(() => {
        source.cancel();
        wlogger.error("No response received from Keycloak " + KEYCLOAK_TOKEN_URL); 
        wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
      }, requestTimeout);
      //Capture
      const result = await axios({
        method: 'post',
        url: KEYCLOAK_TOKEN_URL,
        data: qs.stringify({
          username: req.body.username,
          password: req.body.password,
          client_id: clientId,
          grant_type: grantType
        }),
        headers: {
          'content-type': 'application/x-www-form-urlencoded;charset=utf-8'
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        validateStatus: false,
        cancelToken: source.token
      });
      // Clear The Timeout
      clearTimeout(timeout);
      
      let auth = {};
      auth.token = result.data;
      auth.isAdmin = false;
      auth.isViewer = false;
      let decodedToken;
      let adminRole = (conf.getConfig().adminRole) ? conf.getConfig().adminRole : 'DATAFLOW_MANAGER';
      let viewerRole = (conf.getConfig().viewerRole) ? conf.getConfig().viewerRole : 'DATAFLOW_VIEWER';
      try {        
        decodedToken = jwt.decode(auth.token.access_token); //decodes and verifies the token extracted form the header
        if (decodedToken.resource_access.dafne.roles.indexOf(adminRole) >= 0) {
          auth.isAdmin = true;
          wlogger.info(`Login HTTP Status code for user '${decodedToken.sub}': ${result.status}`);
          wlogger.info(`User '${decodedToken.sub}' has administration grants`);
        } else if (decodedToken.resource_access.dafne.roles.indexOf(viewerRole) >= 0) {
          auth.isViewer = true;
          wlogger.info(`Login HTTP Status code for user '${decodedToken.sub}': ${result.status}`);
          wlogger.info(`User '${decodedToken.sub}' has viewer grants`);
        } else {
          // Cannot access without an assigned role.
          wlogger.error("User role not accepted.");
          return res.status(403).json("User role not accepted.");
        }
      } catch (e) {
        wlogger.error({ 'level': 'error', 'message': { 'Token not valid!': e } });
      }
      return res.status(result.status).json(auth);
  
    } catch (error) {
      wlogger.error("Error retrieving token: " + error);
      return res.status(500).json('Error performing DAFNE login');
    }
  } catch (error) {
    wlogger.error("Generic error in login: " + error);
    return res.status(500).json('Error performing DAFNE login');
  }
};

/** [POST] /auth/logout
 *  @param {string} req.body.refresh_token refresh_token
 */
 exports.logout = async (req, res) => {
  try {
    //Register user model
    const KEYCLOAK_LOGOUT_URL = conf.getLogoutUrl()
    const clientId = conf.getConfig().auth.clientId;
    const AUTH_HEADER = req.get('Authorization');
    const requestTimeout = (conf.getConfig().requestTimeout) ? conf.getConfig().requestTimeout : 30000;
    if (AUTH_HEADER === undefined) {
    
      wlogger.error({ 'level': 'error', 'message': { 'Authorization header is missing!' : ''}});
      return res.status(500).json('Authorization header is missing!');
    }
    const token = AUTH_HEADER.split(' ')[1]; //Bearer xxx
    const decodedToken = jwt.decode(token);
    try {
      const source = axios.CancelToken.source();
							
      let timeout = setTimeout(() => {
        source.cancel();
        wlogger.error("No response received from Keycloak " + KEYCLOAK_LOGOUT_URL); 
        wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
      }, requestTimeout);
      wlogger.info(`Logout attempt for user : ${decodedToken.sub}`);
      //Capture
      const result = await axios({
        method: 'post',
        url: KEYCLOAK_LOGOUT_URL,
        data: qs.stringify({
          client_id: clientId,
          refresh_token: req.body.refresh_token
        }),
        headers: {
          'content-type': 'application/x-www-form-urlencoded;charset=utf-8',
          'Authorization': AUTH_HEADER
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        cancelToken: source.token,
        validateStatus: false
      });
      // Clear The Timeout
      clearTimeout(timeout);
      wlogger.info(`Logout HTTP Status code for user '${decodedToken.sub}': ${result.status}`);
      return res.status(result.status).json(result.data);;
  
    } catch (error) {
      wlogger.error("Error performing logout: " + error);
      return res.status(500).json('Error performing DAFNE logout');
    }
  } catch (error) {
    wlogger.error("Generic error in logout: " + error);
    return res.status(500).json('Error performing DAFNE logout');
  }
};
