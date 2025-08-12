const wlogger = require('app/util/wlogger');
const conf = require('app/util/config');

module.exports = (req, res, next) => {

  try {
    let adminRole = (conf.getConfig().adminRole) ? conf.getConfig().adminRole : 'DATAFLOW_MANAGER';
    
    if (res.tokenvalues.resource_access[conf.getConfig().auth.clientId].roles.indexOf(adminRole) < 0) {
      return res.status(403).json('Not Enough Permission!');
    }
  } catch (error) {
    wlogger.error({ 'level': 'error', 'message': { 'Token not valid!': error } });
    return res.status(403).json('Not Enough Permission!');
  }

  next();
};