var winston = require('winston'); require('winston-daily-rotate-file');
const moment = require('moment');
const conf = require('../util/config');
const path = require('path');

IsJsonString = (str) => typeof (str) == 'string' ? false : true;
let isSeverityLevelValid = true;
if (conf.getConfig().logger.severity.toLowerCase() !== "info" && 
    conf.getConfig().logger.severity.toLowerCase() !== "debug" && 
    conf.getConfig().logger.severity.toLowerCase() !== "warning" && 
    conf.getConfig().logger.severity.toLowerCase() !== "error" ) {
  isSeverityLevelValid = false;
}
const logger = winston.createLogger({
  level: (isSeverityLevelValid ? conf.getConfig().logger.severity.toLowerCase() : "info"),
  format: winston.format.printf(
    info => `[${conf.getVersion()}][${moment().format(conf.getLoggerDateFormat())}] [${(info.level.toUpperCase())}] ${IsJsonString(info.message) ? JSON.stringify(info.message) : info.message}`
  ),
  transports: [
    new (winston.transports.DailyRotateFile)({
      filename: path.join(process.env.LOGS_PATH, conf.getConfig().logger.logname),
      datePattern: (conf.getConfig().logger.datePattern) ? conf.getConfig().logger.datePattern : 'YYYY-MM-DD',
      zippedArchive: conf.getConfig().logger.zippedArchive, //if zips it doesn't delete files
      maxSize: conf.getConfig().logger.maxSize,
      maxFiles: conf.getConfig().logger.maxFiles,
      createSymlink: (conf.getConfig().logger.createSymlink) ? conf.getConfig().logger.createSymlink : true,
      symlinkName: (conf.getConfig().logger.symlinkName) ? conf.getConfig().logger.symlinkName : 'dafne-be.log'
    }),
    
  ]
});

// Log on console if not in production mode  
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(info => `[${conf.getVersion()}][${moment().format(conf.getLoggerDateFormat())}] [${info.level}] ${IsJsonString(info.message) ? JSON.stringify(info.message) : info.message}`)
    )
  }));
}


module.exports = logger;