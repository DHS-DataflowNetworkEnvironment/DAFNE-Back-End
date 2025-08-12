const https = require('https')
const axios = require('axios');
const jwt = require('jsonwebtoken');
const Error = require('app/models/error');
const wlogger = require('app/util/wlogger');
const userInfoUrl = require('app/util/config').getUserinfoUrl();
const conf = require('app/util/config').getConfig();
const auth = require('app/controllers/auth');

/**
 * Read the Token in Bearer xxx, in the Authorization header
 * Verify token, and decodes it
 * Add some values in req.tokenvalues objects, which can be used for next requesr
 */

module.exports = async (req, res, next) => {

  //1 Check the existence of the Authorization Header in the request
  const AUTH_HEADER = req.get('Authorization');
  const KEYCLOAK_USERINFO_URL = userInfoUrl;
  if (AUTH_HEADER === undefined) {
    
    wlogger.error({ 'level': 'error', 'message': { 'Authorization header is missing!' : ''}});
    return res.status(401).json(new Error(401, 'Authorization header is missing'));
  }

  //2 Ckeck if header contains Bearer token
  const token = AUTH_HEADER.split(' ')[1]; //Bearer xxx
  if (token === undefined) {
    wlogger.error({ 'level': 'error', 'message': { 'Token is missing!': '' } });
    return res.status(401).json(new Error(401, 'Token is missing!'));
  }

  //3 Try to decode the token
  
  let decodedToken;
  try {
    decodedToken = jwt.decode(token); //decodes and verifies the token extracted form the header
  } catch (error) {
    wlogger.error({ 'level': 'error', 'message': { 'Token not valid!': error } });
    return res.status(401).json(new Error(401, 'Token not valid!'));
  }
  let timeout;
  //4 Check if the token is valid in Keycloak
  try {
    wlogger.info(`Verify authentication for user : ${decodedToken.sub}`);
    //Capture
    const source = axios.CancelToken.source();
    let requestTimeout = (conf.requestTimeout) ? conf.requestTimeout : 30000;
    timeout = setTimeout(() => {
      source.cancel();
      wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
    }, requestTimeout);

    const result = await axios({
      method: 'post',
      url: KEYCLOAK_USERINFO_URL,
      headers: {
        'Authorization': AUTH_HEADER
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      validateStatus: false,
      cancelToken: source.token
    });
    
    // Clear The Timeout
    clearTimeout(timeout);
    wlogger.info(`Token validity status for user '${decodedToken.sub}': ${result.status}`);
    if (result.status != 200) {
      if (result.status == 401) {
        // Refresh token
        wlogger.info("Trying to refresh user token..");
        const refreshRes = await auth.refreshUserToken(decodedToken.sub);
        if (refreshRes.status === 500) {
          wlogger.info("Could not refresh token.")
          return res.status(401).json(new Error(401, 'Refresh Token not valid! Unauthorized.'));
        } else if (refreshRes.status === 400) {
          wlogger.info("Could not refresh token.")
          return res.status(401).json(new Error(401, 'Refresh Token not valid! Unauthorized.'));
        } else if (refreshRes.status > 200) {
          wlogger.info("Error "+refreshRes.status+". Could not refresh token.")
          return res.status(401).json(new Error(401, 'Refresh Token not valid! Unknown error.'));
        }
        
        decodedToken = refreshRes.decodedToken;
      } else {
        return res.status(result.status).json(new Error(result.status, 'Internal Server Error'));
      }
    }

  } catch (error) {
    wlogger.error("Error validating token: " + error);
    return res.status(500).json(new Error(500, 'Internal Server Error'));
  }

  
  //Token is valid, Add tokenvalues to request, filtering password
  res.tokenvalues = {};
  res.tokenvalues = decodedToken;
  next(); //Forward request
};