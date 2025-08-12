const qs = require('qs')
const https = require('https')
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { NONAME } = require('dns');
const wlogger = require('app/util/wlogger');
const authConfig = require('app/util/config').getAuthConfig();
const requestTimeout = require('app/util/config').getRequestTimeout();
const keycloakTokenUrl = require('app/util/config').getTokenUrl();
const keycloakLogoutUrl = require('app/util/config').getLogoutUrl();
const conf = require('app/util/config').getConfig();

let userDataArray = [];


/** [POST] BE internal use
 */
exports.refreshUserToken = async (sub) => {
  try {
    wlogger.info(`User ${sub} token refresh attempt..`);
    let userDataIndex;
    userDataArray.forEach((userData, index) => {
      if (userData && userData.hasOwnProperty('sub') && userData.sub == sub) {
        userDataIndex = index;
      }
    });
    if (userDataIndex == undefined) {
      wlogger.error("Couldn't find any saved Refresh token for user with sub: " + sub);
      return {status: 500, status_description: 'User token is not in the token array'};
    }
    const source = axios.CancelToken.source();
							
    let timeout;

    let data = '';
   
    if (userDataArray[userDataIndex].hasOwnProperty('sub') && userDataArray[userDataIndex].sub == sub) {
      timeout = setTimeout(() => {
        source.cancel();
        wlogger.error("No response received from Keycloak " + keycloakTokenUrl.href); 
        wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
      }, requestTimeout);

      data = qs.stringify({
        'username': userDataArray[userDataIndex].username,
        'client_id': userDataArray[userDataIndex].client_id,
        'grant_type': 'refresh_token',
        'refresh_token': userDataArray[userDataIndex].refresh_token
      })
    } else {
      return {status: 500, status_description: 'User token not found'};
    }

    const result = await axios({
      method: 'post',
      url: keycloakTokenUrl.href,
      data: data,
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      validateStatus: false,
      cancelToken: source.token
    });
    // Clear The Timeout
    if (timeout !== undefined) clearTimeout(timeout);

    if (result.data.hasOwnProperty('error')) {
      return {status: result.status, status_description: result.data.error};
    }

    let auth = {};
    auth.isAdmin = false;
    auth.isViewer = false;
    let decodedToken;
    let adminRole = (conf.adminRole) ? conf.adminRole : 'DATAFLOW_MANAGER';
    let viewerRole = (conf.viewerRole) ? conf.viewerRole : 'DATAFLOW_VIEWER';
    try {        
      decodedToken = jwt.decode(result.data.access_token); //decodes and verifies the token extracted form the header
      if (decodedToken.resource_access[conf.auth.clientId].roles.indexOf(adminRole) >= 0) {
        auth.isAdmin = true;
        wlogger.info(`User '${decodedToken.sub}' has administration grants`);
        // Put the Admin role as first in the array
        decodedToken.resource_access[conf.auth.clientId].roles.sort((a, b) => (a === adminRole ? -1 : b === adminRole ? 1 : a.localeCompare(b)));
      } else if (decodedToken.resource_access[conf.auth.clientId].roles.indexOf(viewerRole) >= 0) {
        auth.isViewer = true;
        wlogger.info(`User '${decodedToken.sub}' has viewer grants`);
        // Put the viewer role as first in the array
        decodedToken.resource_access[conf.auth.clientId].roles.sort((a, b) => (a === viewerRole ? -1 : b === viewerRole ? 1 : a.localeCompare(b)));
      } else {
        // Cannot access without an assigned role.
        wlogger.error("User role not accepted. Received roles: " + JSON.stringify(decodedToken.resource_access[conf.auth.clientId].roles, null, 2));
        return {status: 403, status_description: "User role not accepted. Received roles: " + JSON.stringify(decodedToken.resource_access[conf.auth.clientId].roles, null, 2)};
      }
      result.data.access_token = jwt.sign(decodedToken, 'dafne-secret');
      auth.token = result.data;
    } catch (e) {
      userDataArray.splice(userDataIndex, 1);
      wlogger.error({ 'level': 'error', 'message': { 'Token not valid!': e } });
    }
    //auth.decodedToken = decodedToken;
    userDataArray[userDataIndex].refresh_token = result.data.refresh_token;
    wlogger.info("User token has been refreshed.");
    return {status: result.status, decodedToken: decodedToken};

  } catch (error) {
    wlogger.error("Refresh token is not valid: " + error);
    return {status: 401, status_description: 'Cannot refresh token'};
  }
}

/** [POST] /auth/token
 *  @param {string} req.body.username username
 *  @param {string} req.body.password password
 */
exports.token = async (req, res) => {
  let tempUserData = {};
  try {
    //Register user model
    const clientId = authConfig.clientId;
    const grantType = authConfig.grantType;
    try {
      wlogger.info(`User login attempt`);
      const source = axios.CancelToken.source();
							
      let timeout = setTimeout(() => {
        source.cancel();
        wlogger.error("No response received from Keycloak " + keycloakTokenUrl.href); 
        wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
      }, requestTimeout);
      //Capture
      const result = await axios({
        method: 'post',
        url: keycloakTokenUrl.href,
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
      auth.isAdmin = false;
      auth.isViewer = false;
      let decodedToken;
      let adminRole = (conf.adminRole) ? conf.adminRole : 'DATAFLOW_MANAGER';
      let viewerRole = (conf.viewerRole) ? conf.viewerRole : 'DATAFLOW_VIEWER';
      try {        
        decodedToken = jwt.decode(result.data.access_token); //decodes and verifies the token extracted form the header
        if (decodedToken.resource_access[conf.auth.clientId].roles.indexOf(adminRole) >= 0) {
          auth.isAdmin = true;
          wlogger.info(`User '${decodedToken.sub}' has administration grants`);
          // Put the Admin role as first in the array
          decodedToken.resource_access[conf.auth.clientId].roles.sort((a, b) => (a === adminRole ? -1 : b === adminRole ? 1 : a.localeCompare(b)));
        } else if (decodedToken.resource_access[conf.auth.clientId].roles.indexOf(viewerRole) >= 0) {
          auth.isViewer = true;
          wlogger.info(`User '${decodedToken.sub}' has viewer grants`);
          // Put the viewer role as first in the array
          decodedToken.resource_access[conf.auth.clientId].roles.sort((a, b) => (a === viewerRole ? -1 : b === viewerRole ? 1 : a.localeCompare(b)));
        } else {
          // Cannot access without an assigned role.
          wlogger.error("User role not accepted. Received roles: " + JSON.stringify(decodedToken.resource_access[conf.auth.clientId].roles, null, 2));
          return res.status(403).json("User role not accepted. Received roles: " + JSON.stringify(decodedToken.resource_access[conf.auth.clientId].roles, null, 2));
        }
        result.data.access_token = jwt.sign(decodedToken, 'dafne-secret');
        auth.token = result.data;
        auth.clientId = conf.auth.clientId;
      } catch (e) {
        wlogger.error({ 'level': 'error', 'message': { 'Token not valid!': e } });
      }
      // save user data to refresh token
      tempUserData = {
        sub: decodedToken.sub,
        username: req.body.username,
        client_id: clientId,
        refresh_token: result.data.refresh_token,
        isAdmin: auth.isAdmin
      };
      userDataArray.push(tempUserData);

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
    let sub = jwt.decode(req.body.refresh_token).sub;
    wlogger.debug("User with sub: " + sub + " asked for logout.");
    let userDataIndex;
    userDataArray.forEach((userData, index) => {
      if (userData && userData.hasOwnProperty('sub') && userData.sub == sub) {
        userDataIndex = index;
        wlogger.debug("Found userData with index: " + userDataIndex);
      }
    });
    if (userDataIndex == undefined) {
      wlogger.debug("Couldn't find any saved user info with sub: " + sub);
    }
    //Register user model
    const clientId = authConfig.clientId;
    const AUTH_HEADER = req.get('Authorization');
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
        wlogger.error("No response received from Keycloak " + keycloakLogoutUrl.href); 
        wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
      }, requestTimeout);
      wlogger.info(`Logout attempt for user : ${decodedToken.sub}`);
      //Capture
      const result = await axios({
        method: 'post',
        url: keycloakLogoutUrl.href,
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

      if (userDataArray.length > 0) {
        userDataArray.splice(userDataIndex, 1);
        wlogger.debug("Deleted userinfo for user with sub: " + sub);
      }
      return res.status(result.status).json(result.data);
  
    } catch (error) {
      wlogger.error("Error performing logout: " + error);
      return res.status(500).json('Error performing DAFNE logout');
    }
  
  } catch (error) {
    wlogger.error("Generic error in logout: " + error);
    return res.status(500).json('Error performing DAFNE logout');
  }
};

/** [POST] /auth/is-auth
 *  @param {string} req.body.refresh_token refresh_token
 */
exports.isAuth = async (req, res) => {
  return res.status(200).json('is auth response');
};

/** [GET] /auth/check-admin-count
 */
exports.checkAdminCount = async (req, res) => {
  let adminCount = userDataArray.filter((userData) => userData.isAdmin == true).length;
  return res.status(200).json({adminCount: adminCount});
};