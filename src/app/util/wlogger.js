const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, printf } = format;
require('winston-daily-rotate-file');
const moment = require('moment');
const wloggerConfig = require('./config').getWloggerConfig();
const dafneBackendVersion = require('./config').getVersion();
const path = require('path');

IsJsonString = (str) => typeof (str) == 'string' ? false : true;

let isSeverityLevelValid = true;
if (wloggerConfig.severity.toLowerCase() !== "info" && 
    wloggerConfig.severity.toLowerCase() !== "debug" && 
    wloggerConfig.severity.toLowerCase() !== "warning" && 
    wloggerConfig.severity.toLowerCase() !== "error" ) {
  isSeverityLevelValid = false;
}

const logFormat = printf(({ level, message, label, timestamp }) => {
  return `[${timestamp}] [${dafneBackendVersion}] [${level}]: ${message}`;
});

const logger = createLogger({
  level: (isSeverityLevelValid ? wloggerConfig.severity.toLowerCase() : "info"),
  format: combine(
    format(info => {
      info.level = info.level.toUpperCase();
      return info;
    })(),
    timestamp(),
    logFormat
  ),
  transports: [
    new (transports.DailyRotateFile)({
      filename: path.join(process.env.LOGS_PATH, wloggerConfig.logname),
      datePattern: (wloggerConfig.datePattern) ? wloggerConfig.datePattern : 'YYYY-MM-DD',
      zippedArchive: wloggerConfig.zippedArchive, //if zips it doesn't delete files
      maxSize: wloggerConfig.maxSize,
      maxFiles: wloggerConfig.maxFiles,
      createSymlink: (wloggerConfig.createSymlink) ? wloggerConfig.createSymlink : true,
      symlinkName: (wloggerConfig.symlinkName) ? wloggerConfig.symlinkName : 'dafne-be.log'
    })
  ]
});

// Log on console if not in production mode  
if (process.env.NODE_ENV !== 'production') {
  logger.add(new transports.Console({
    format: combine(
      format(info => {
        info.level = info.level.toUpperCase();
        return info;
      })(),
      format.colorize({all: true}),
      timestamp(),
      logFormat
    ),
    level: "debug"
  }));
}

module.exports = logger;