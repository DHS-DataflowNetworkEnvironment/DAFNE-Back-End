const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const devLogger = require('morgan');

const indexRouter = require('app/routes/index');

const conf = require('app/util/config');
const cron = require('node-cron');
const controller = require('app/controllers/reports');
const wlogger = require('app/util/wlogger');
const app = express();

// view engine setup
console.log("__dirname: " + __dirname);
app.set('views', path.join(__dirname, 'app/views'));
app.set('view engine', 'pug');

//Set proper Headers on Backend
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.use(devLogger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'app/public')));

// Set cors:
const cors = require('cors');
app.use(cors({ origin: '*' })); // Put frontend IP here.

// ROUTES
app.use('/', indexRouter);
app.use('/dev', require('app/routes/dev')); 
app.use('/auth', require('app/routes/auth')); //Authentication based on Keycloak
app.use('/servicetypes', require('app/routes/service_types'));
app.use('/services', require('app/routes/services'));
app.use('/centres', require('app/routes/centres'));
app.use('/ingesters', require('app/routes/ingesters'));
app.use('/products', require('app/routes/products'));
app.use('/config', require('app/routes/config'));
app.use('/reports', require('app/routes/reports'));


// Setup cron schedule - The function is actually disabled
/* cron.schedule(conf.getConfig().report.deleteReportsCronSchedule, async () => { 
  const thirdYearAgo = new Date().getFullYear() - 3;
  wlogger.info("Run scheduled deletion of generated reports for year: " + thirdYearAgo);
  try {
    const res = await controller.deleteGeneratedReportFolder(thirdYearAgo);
    if (res && res.code == "ENOENT") {
      wlogger.info("Folder " + thirdYearAgo + " is not present.");
    } else if (res.hasOwnProperty('code')) {
      wlogger.info("Folder " + thirdYearAgo + " could not be deleted. Error: " + res.code);
    } else {
      wlogger.info("Folder " + thirdYearAgo + " and its contents have been correctly deleted");
    }
  } catch (err) {
    wlogger.error("Unexpected error while deleting " + thirdYearAgo + " folder.");
  }
}); */

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
