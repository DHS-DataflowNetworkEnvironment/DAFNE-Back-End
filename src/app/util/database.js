//SRP: Database connection util
const Sequelize = require('sequelize');
const wlogger = require('./wlogger');
const dbParams = require('./config').getDatabaseConfig();

const sequelize = new Sequelize(
    dbParams.database,
    dbParams.username,
    dbParams.password,
    {
        host: dbParams.host,
        port: dbParams.port,
        dialect: dbParams.dialect,
        logging: msg => wlogger.info({ level: 'info', message: msg }),
        pool: {
            max: (dbParams.pool && dbParams.pool.max) ? dbParams.pool.max : 10,
            min: (dbParams.pool && dbParams.pool.min) ? dbParams.pool.min : 0,
            acquire: (dbParams.pool && dbParams.pool.acquire) ? dbParams.pool.acquire : 60000,
            idle: (dbParams.pool && dbParams.pool.idle) ? dbParams.pool.idle : 10000
      }
    });

module.exports = sequelize;