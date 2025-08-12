
const path = require('path');
const configFile = require(process.env.CONF_PATH + "config.json");
const env = process.env.NODE_ENV || 'development';

exports.getConfig = () => {
  return configFile;
}

exports.getDatabaseConfig = () => {
  return configFile[env];
}

exports.getWloggerConfig = () => {
  return configFile.logger;
}

exports.getLoggerDateFormat = () => {
  var logFormat = 'YYYY-MM-DD HH:mm:ss.SSS';
  if(configFile.logger.dateFormat)
      logFormat = configFile.logger.dateFormat;
  return logFormat;
};

exports.getVersion = () => {
  return configFile.version;
};

exports.getAuthConfig = () => {
  return configFile.auth;
}

exports.getRequestTimeout = () => {
  var timeout = 30000;
  if (configFile.requestTimeout)
    timeout = configFile.requestTimeout;
  return timeout;
};

exports.getTokenUrl = () => {
  const KEYCLOAK_BASE_URL = configFile.auth.keycloakBaseUrl;
  return (configFile.auth.tokenEndPoint) ? new URL(KEYCLOAK_BASE_URL + configFile.auth.tokenEndPoint) : new URL(KEYCLOAK_BASE_URL + '/token'); 
};

exports.getUserinfoUrl = () => {
  const KEYCLOAK_BASE_URL = configFile.auth.keycloakBaseUrl;
  return (configFile.auth.userinfoEndPoint) ? new URL(KEYCLOAK_BASE_URL + configFile.auth.userinfoEndPoint) : new URL(KEYCLOAK_BASE_URL + '/userinfo');
};

exports.getLogoutUrl = () => {
  const KEYCLOAK_BASE_URL = configFile.auth.keycloakBaseUrl;
  return (configFile.auth.logoutEndPoint) ? new URL(KEYCLOAK_BASE_URL + configFile.auth.logoutEndPoint) : new URL(KEYCLOAK_BASE_URL + '/logout');
};