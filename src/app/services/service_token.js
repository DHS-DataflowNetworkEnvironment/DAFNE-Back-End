const axios = require('axios');
const qs = require('qs');
const jwt = require('jsonwebtoken');
const wlogger = require('app/util/wlogger');
const Utilcrypto = require('app/util/utilcrypto');
const { token } = require('app/controllers/auth');

let servicesTokensArray = [];

exports.getServiceToken = async (service) => {
  let tempServiceToken;
  servicesTokensArray.forEach(async (serviceToken, index) => {
    // if a request for refresh token will be used in the future, please use the for loop to enable await function:
    if (serviceToken.id === service.id) {
      // A token for this service is already present. Check if it is valid:
      wlogger.debug("Token already present for service with id: " + service.id + ". Checking if it is still valid..");
      let nowSec = Math.floor(Date.now() / 1000);
      if (serviceToken.hasOwnProperty('token') && serviceToken.token != undefined) {
        if (serviceToken.token.hasOwnProperty('access_token')) { 
          decodedToken = jwt.decode(serviceToken.token.access_token);
          if (nowSec > decodedToken.exp) {
            wlogger.debug("Token expired.. Ask for a new one.");
          } else {
            wlogger.debug("Token is still valid. Using that.");
            tempServiceToken = serviceToken.token;
            return tempServiceToken;
          }
        }
      } else {
        wlogger.error("Token for service with id: "+ service.id +" is not valid. There was an issue with the credentials for service: " + service.service_url);
      }
    }
  });
  
  if (tempServiceToken !== undefined) {
    return tempServiceToken;
  }

  // Token is not present. Requesting a new one
  let data = qs.stringify({
    'username': service.username,
    'password': Utilcrypto.decrypt(service.password),
    'grant_type': 'password',
    'client_id': service.client_id
  });
  let config = {
    method: 'post',
    url: service.token_url,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }, 
    data: data
  };
  const res = await axios(config)
    .catch(err => {
      if (err.response) {
          // client received an error response (5xx, 4xx)
          wlogger.error("Received error response from Service while asking for token.  URL: " + service.token_url); 
          wlogger.error(err);
      } else if (err.request) {
          // client never received a response, or request never left
          wlogger.error("No response received from Service while asking for token.  URL: " + service.token_url); 
          wlogger.error(err);                      
      } else {
          // anything else
          wlogger.error("Error from Service while asking for token.  URL: " + service.token_url); 
          wlogger.error(err);
      }
      return {};
  })
  if (res.hasOwnProperty('data')) {
    servicesTokensArray.push({
      id: service.id,
      token: res.data
    });
    return res.data
  }
  return res;
}

exports.removeServiceToken = async (service) => {
  servicesTokensArray.forEach((serviceToken, index, object) => {
    if (serviceToken.id === service.id) {
      object.splice(index, 1);
    }
  });
}