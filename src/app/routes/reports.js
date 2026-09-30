const router = require('express').Router();
const controller = require('app/controllers/reports');
const isAuth = require('app/auth/is-auth');

router.get('/get-reports-folder-name', controller.getReportsFolderName);
router.get('/check-single-day-report/:day', controller.checkSingleDay);
router.get('/get-single-day-report-Json/:day', controller.getSingleDayReportJson);
router.post('/get-report-json-for-period', controller.getReportJsonForPeriod);
router.get('/get-reports-file-structure', controller.getReportFileStructure);
router.post('/download-report', controller.downloadReport);
router.post('/delete-generated-report', controller.deleteGeneratedReport);

module.exports = router;


