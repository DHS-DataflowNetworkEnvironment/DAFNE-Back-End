const Config = require('refresh-config');
const fs = require('fs');
const path = require('path');
var urljoin = require('url-join');

const confPath = path.join(process.env.CONF_PATH, 'config.json');

var config = Config(confPath);

config.on('error', function(err) {
    console.error(err.stack);
});

config.on('change', function() {
    console.log('configuration updated');
});

exports.getConfig = () => {
    return config.data;
};

exports.getDatabaseConfig = () => {
    return config.data[process.env.NODE_ENV];
}

exports.getVersion = () => {
    return config.data.version;
};

exports.getLoggerDateFormat = () => {
    var logFormat = 'YYYY-MM-DD HH:mm:ss,SSS';
    if(config.data.logger.dateFormat)
        logFormat = config.data.logger.dateFormat;
    return logFormat;
};

exports.getTokenUrl = () => {
    const KEYCLOAK_BASE_URL = config.data.auth.keycloakBaseUrl;
    return (config.data.auth.tokenEndPoint) ? urljoin(KEYCLOAK_BASE_URL, config.data.auth.tokenEndPoint) : urljoin(KEYCLOAK_BASE_URL, 'token'); 
};

exports.getUserinfoUrl = () => {
    const KEYCLOAK_BASE_URL = config.data.auth.keycloakBaseUrl;
    return (config.data.auth.userinfoEndPoint) ? urljoin(KEYCLOAK_BASE_URL, config.data.auth.userinfoEndPoint) : urljoin(KEYCLOAK_BASE_URL, 'userinfo');
};

exports.getLogoutUrl = () => {
    const KEYCLOAK_BASE_URL = config.data.auth.keycloakBaseUrl;
    return (config.data.auth.logoutEndPoint) ? urljoin(KEYCLOAK_BASE_URL, config.data.auth.logoutEndPoint) : urljoin(KEYCLOAK_BASE_URL, 'logout');
};