const axios = require('axios');
const wlogger = require('../util/wlogger');
const Utilcrypto = require('../util/Utilcrypto');
const qs = require('qs');

exports.getServiceToken = async (service) => {
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
          try {
              description = (err.toJSON()).message;
          } catch (e) {
              description = "Received error response from Service while asking for token.  URL: " + service.token_url;
          }
          wlogger.error("Received error response from Service while asking for token.  URL: " + service.token_url); 
          wlogger.error(err);
          //console.log(err.toJSON());
      } else if (err.request) {
          try {
              description = (err.toJSON()).message;
          } catch (e) {
              description = "No response received from Service while asking for token.  URL: " + service.token_url;
          }
          // client never received a response, or request never left
          wlogger.error("No response received from Service while asking for token.  URL: " + service.token_url); 
          wlogger.error(err);
          //console.log(err.toJSON());                       
      } else {
          try {
              description = (err.toJSON()).message;
          } catch (e) {
              description = "Error from Service while asking for token.  URL: " + service.token_url;
          }
          // anything else
          wlogger.error("Error from Service while asking for token.  URL: " + service.token_url); 
          wlogger.error(err);
          //console.log(err.toJSON());
      }
      return;
  });
  return res.data
}