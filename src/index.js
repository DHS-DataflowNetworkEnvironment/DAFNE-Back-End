const express = require('express');
const bodyParser = require('body-parser');
const sequelize = require('./app/util/database'); //database initializations
const wlogger = require('./app/util/wlogger');
const scheduleAvailability = require('./app/services/availability');
const scheduleLatency = require('./app/services/publication_latency');

//INITIALIZE APP WITH EXPRESS
const app = express();
const dbParams = require('./app/util/config').getDatabaseConfig();
const config = require('./app/util/config');

//BODYPARSER
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

//Set proper Headers on Backend
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Origin, X-Requested-With, Content-Type, Accept');
  next();
});

//ROUTES
//All test routes are placed here
app.use('/dev', require('./app/routes/dev')); 
app.use('/auth', require('./app/routes/auth')); //Authentication based on Keycloak
app.use('/servicetypes', require('./app/routes/service_types'));
app.use('/services', require('./app/routes/services'));
app.use('/centres', require('./app/routes/centres'));
app.use('/synchronizers', require('./app/routes/synchronizers'));
app.use('/products', require('./app/routes/products'));
app.use('/config', require('./app/routes/config'));

(async () => {
  wlogger.log({ level: 'info', message: process.env });  //Log ENVIRONMENT VARIABLES
  try {
    if (dbParams.username !== undefined) {
      // wait till Sequelize is synchronized
      await sequelize.sync({ force: false }); // force: true recreate db every time
      app.listen(config.getConfig().port);
      wlogger.info('Server READY');
      scheduleAvailability.createScheduler();
      scheduleAvailability.createPurgeScheduler();
      scheduleLatency.createScheduler();
      scheduleLatency.createPurgeScheduler();
      scheduleLatency.createFeRetryScheduler();
      setInterval(function() {
        scheduleAvailability.checkAndUpdateScheduler();
        scheduleLatency.checkAndUpdateScheduler();
        scheduleLatency.checkAndUpdateFeRetryScheduler();
      }, 60000);  //TODO: replace with cfg param. At present check for new availability schedule every minute
      
      
      
    } else {
      wlogger.error('dbParams.username' + dbParams.username);
    }
  } catch (error) {
     wlogger.error(error)
  }
})();

process.on('SIGINT',  () => {
  wlogger.info('Received SIGINT signal. Shutting down');
  process.exit();
});

process.on('SIGTERM', () => {
  wlogger.info('Received SIGTERM signal. Shutting down');
  process.exit();
});


logTest = () => {
  setInterval(() => wlogger.log({ level: 'info', message: 'LONG SYNTAX INFO MESSAGE EXAMPLE' }), 900);
  setInterval(() => wlogger.warn({ 'level': 'warn', 'message': 'LONG SYNTAX warn MESSAGE EXAMPLE' }), 2100);
  setInterval(() => wlogger.error({ 'level': 'error', 'message': 'LONG SYNTAX error MESSAGE EXAMPLE' }), 3100);

  setInterval(() => wlogger.info(`Hello log`), 1000);
  setInterval(() => wlogger.warn(`Hi  am a Warning`), 2000);
  setInterval(() => wlogger.error(`Hi i am an ERROR`), 3000);
}
