const sequelize = require('../util/database');
const wlogger = require('../util/wlogger');
const conf = require('../util/config');
const path = require('path');

// [GET] ../dev/version
exports.getVersion = (req, res, next) => {
  wlogger.info({ 'level': 'info', 'message': `[GET] ../dev/version: ${conf.getConfig().version}` });
  return res.status(200).json( `${conf.getConfig().version}` );
};

// [GET] ../dev/seq
exports.seq = async (req, res, next) => {
  try {
    await sequelize.authenticate();
    wlogger.info({ 'level': 'info', 'message': 'Sequelize Connection established' });
    res.status(200).json('Sequelize Connection established');
    next();
  } catch (error) {
    wlogger.error({ 'level': 'error', 'message': 'ERROR IN SEQUELIZE Connection' });
    res.status(500).json('ERROR IN SEQUELIZE Connection');
  }
};


