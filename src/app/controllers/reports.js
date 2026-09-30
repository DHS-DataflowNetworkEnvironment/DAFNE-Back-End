const conf = require('app/util/config');
const axios = require('axios');
const wlogger = require('app/util/wlogger');
const { getLocalCentreName } = require('../controllers/centres');

const fs = require("fs/promises");
const path = require("path");
const XLSX = require("xlsx-js-style");
const JSZip = require("jszip");
const { NONAME } = require('dns');

let productTypeFamilyList = [];
let productTypeList = [];
let datasourcesMap = [];

const datasourceColorArr = [
  "fafafa", "ffffcc", "e6b9b8", "d7e4bd", "fcd5b5", "ccc1da", "9ec4f3", "a1ccc6",
  "ffffcc", "e6b9b8", "d7e4bd", "fcd5b5", "ccc1da", "9ec4f3", "a1ccc6"
];
const statsSheetsCols = ["Key", "From", "To", "Product Type", "NB Products", "Size (TiB)"];
const statsBWSheetCols = ["Key", "From", "To", "Product Type", "Bandwidth (Mbps)"];

// Get Legenda Text:
const legendaJsonData = [
  ["LEGENDA"],
  [
    "Sheet name", "Description"
  ],
  [
    "Retrieved Stats", 
    "This sheet reports detailed information about data retrieved from configured Datasources. In particular, a table with the following information is filled:\n\
- Key : combination of Datasource URL and retrieved product type\n\
- From : Datasource name\n\
- To : Local Centre with respect to the report is generated\n\
- Product Type : product type of retrieved products\n\
- NB Products : number of retrieved products\n\
- Size (TiB) : Size in TiB of retrieved products "
  ],
  [
    "Distributed Stats",
    "This sheet reports detailed information about data distributed to other DHRs. In particular, a table with the following information is filled:\n\
- Key : combination of DHR URL and distributed product type\n\
- From : Local Centre with respect to the report is generated\n\
- To : DHR name to which products are distributed\n\
- Product Type : product type of distributed products\n\
- NB Products : number of distributed products\n\
- Size (TiB) : Size in TiB of distributed products"
  ],
  [
    "Bandwidth Retrieved Stats",
    "This sheet reports detailed information about bandwidth during the products retrieval from configured Datasources. In particular, a table with the following information is filled:\n\
- Key : combination of Datasource URL and retrieved product type\n\
- From : Datasource name\n\
- To : Local Centre with respect to the report is generated\n\
- Product Type : product type of retrieved products\n\
- Bandwidth (Mbps) : Bandwidth in Mbps of retrieved products "
  ],
  [
    "Bandwidth Distributed Stats",
    "This sheet reports detailed information about bandwidth during the products distribution to other DHRs. In particular, a table with the following information is filled:\n\
- Key : combination of DHR URL and distributed product type\n\
- From : Local Centre with respect to the report is generated\n\
- To : DHR name to which products are distributed\n\
- Product Type : product type of distributed products\n\
- Bandwidth (Mbps) : Bandwidth in Mbps of distributed products "
  ],
  [
    "Retrieved",
    "This sheet reports cumulative information about data retrieved from configured Datasources.\n\
For each Mission and Platform the total number and size of products retrieved from a specific Datasource are reported.\n\
Morevoer, a summary (in number and size) of all products retrieved from all Datasources is reported at the end of the table."
  ],
  [
    "Distributed",
    "This sheet reports cumulative information about data distributed to other DHRs.\n\
For each Mission and Platform the total number and size of products distributed to a specific DHR are reported.\n\
Morevoer, a summary (in number and size) of all products distributed to all DHRs is reported at the end of the table."
  ],
  [
    "Bandwidth Retrieved",
    "This sheet reports the average bandwidth of retrieved products from configured Datasources.\n\
For each Mission and Platform the average bandwidth with which products have been retrieved from a specific Datasource is reported.\n\
Moreover, a summary of the average bandwidth with which products have been retrieved from all Datasources is reported at the end of the Table. "
  ],
  [
    "Bandwidth Distributed",
    "This sheet reports the average bandwidth of distributed products to other DHRs.\n\
For each Mission and Platform the average bandwidth with which products have been distributed to a specific DHRs is reported.\n\
Moreover, a summary of the average bandwidth with which products have been distriuted to all DHRs is reported at the end of the Table. "
  ],
  [
    "Error Log",
    "This sheet reports the list of the errors generated while retrieving data from the log files, or during the creation of this file."
  ]
];
let localCentre = "";

async function getProductTypeFamilyList() {
  try {
    let productTypeFamilyList = await axios({
      method: 'get',
      maxBodyLength: Infinity,
      url: (new URL(conf.getConfig().report.reportBackendBaseurl + "/reports/get-product-type-family-list")).href,
      auth: {
        username: conf.getConfig().report.username,
        password: conf.getConfig().report.password
      },
      headers: {
        'Content-Type': 'application/json'
      }
    }).catch(err => {
      if (err.response) {
        // client received an error response (5xx, 4xx)
        wlogger.error("Received error response while getting product type family list" ); 
        wlogger.error(err);
      } else if (err.request) {
        // client never received a response, or request never left
        wlogger.error("No response received while checking getting product type family list"); 
        wlogger.error(err);
      } else {
        // anything else
        wlogger.error("Error while checking getting product type family list"); 
        wlogger.error(err);
      }
    });
    return productTypeFamilyList;
  } catch (error) {
    wlogger.error({ "ERROR get-product-type-family-list:": error });
    return error;
  }
}

async function getProductTypeList() {
  try {
    let productTypeList = await axios({
      method: 'get',
      maxBodyLength: Infinity,
      url: (new URL(conf.getConfig().report.reportBackendBaseurl + "/reports/get-product-type-list")).href,
      auth: {
        username: conf.getConfig().report.username,
        password: conf.getConfig().report.password
      },
      headers: {
        'Content-Type': 'application/json'
      }
    }).catch(err => {
      if (err.response) {
        // client received an error response (5xx, 4xx)
        wlogger.error("Received error response while getting product type list" ); 
        wlogger.error(err);
      } else if (err.request) {
        // client never received a response, or request never left
        wlogger.error("No response received while checking getting product type list"); 
        wlogger.error(err);
      } else {
        // anything else
        wlogger.error("Error while checking getting product type list"); 
        wlogger.error(err);
      }
    });
    return productTypeList;
  } catch (error) {
    wlogger.error({ "ERROR get-product-type-list:": error });
    return error;
  }
}

async function getDatasourcesMap() {
  try {
    let datasourcesMap = await axios({
      method: 'get',
      maxBodyLength: Infinity,
      url: (new URL(conf.getConfig().report.reportBackendBaseurl + "/reports/get-datasources-map")).href,
      auth: {
        username: conf.getConfig().report.username,
        password: conf.getConfig().report.password
      },
      headers: {
        'Content-Type': 'application/json'
      }
    }).catch(err => {
      if (err.response) {
        // client received an error response (5xx, 4xx)
        wlogger.error("Received error response while getting datasources map" ); 
        wlogger.error(err);
      } else if (err.request) {
        // client never received a response, or request never left
        wlogger.error("No response received while checking getting datasources map"); 
        wlogger.error(err);
      } else {
        // anything else
        wlogger.error("Error while checking getting datasources map"); 
        wlogger.error(err);
      }
    });
    return datasourcesMap;
  } catch (error) {
    wlogger.error({ "ERROR get-datasources-map:": error });
    return error;
  }
}



exports.deleteGeneratedReportFolder = async (thirdYearAgo) => {
  try {
    const reportsFolder = conf.getConfig().report.reportsStorageFolder;
    const folderToBeDeleted = reportsFolder + "/" + thirdYearAgo;
    const folderStats = await fs.stat(folderToBeDeleted);
    if (folderStats.isDirectory()) {
      await fs.rm(folderToBeDeleted, { recursive: true, force: true });
      return {};
    }
    await fs.stat(folderToBeDeleted + "/test-if-path-is-not-a-folder_throw-error");
  } catch (error) {
    return error;
  }
}

exports.deleteGeneratedReport = async (req, res, next) => {
  try {
    const reportName = req.body.fileName;
    if (!reportName || reportName == "") return res.status(500).json("File name missing from body when trying to delete generated report.");
    const reportsFolder = conf.getConfig().report.reportsStorageFolder;
    const fileToBeDeleted = "" + reportsFolder + "/" + reportName;
    const fileStats = await fs.stat(fileToBeDeleted);
    if (fileStats.isFile()) {
      await fs.rm(fileToBeDeleted, { recursive: true, force: true });
      return res.status(200).json("Report file " + fileToBeDeleted + " has been correctly deleted.");
    } else {
      return res.status(500).json("Report file " + fileToBeDeleted + " to be deleted is not a valid file.");
    }
  } catch (error) {
    return res.status(500).json(error);
  }
}

exports.getReportsFolderName = async (req, res, next) => {
  try {
    const folderName = conf.getConfig().report.reportsStorageFolder;
    await fs.mkdir(folderName, { recursive: true });
    return res.status(200).json(folderName);
  } catch (error) {
    wlogger.error({ "ERROR sending reports folder name:": error });
    return res.status(500).json(error);
  }
}

exports.checkSingleDay = async (req, res, next) => {
  if (!req.params.day) {
    res.status(400).send("Report day not received");
  }
  try {
    const report = await axios({
      method: 'post',
      maxBodyLength: Infinity,
      url: (new URL(conf.getConfig().report.reportBackendBaseurl + conf.getConfig().report.checkSingleDayUrl.replace(":day", req.params.day))).href,
      auth: {
        username: conf.getConfig().report.username,
        password: conf.getConfig().report.password
      },
      headers: {
        'Content-Type': 'application/json'
      }
    }).catch(err => {
      if (err.response) {
        // client received an error response (5xx, 4xx)
        wlogger.error("Received error response while checking report for date" + date); 
        wlogger.error(err);
      } else if (err.request) {
        // client never received a response, or request never left
        wlogger.error("No response received while checking report for date " + date); 
        wlogger.error(err);
      } else {
        // anything else
        wlogger.error("Error while checking report for date " + date); 
        wlogger.error(err);
      }
    });
    return res.status(200).json(report.data);
  } catch (error) {
    wlogger.error({ "ERROR check-single-day-report:": error });
    return res.status(500).json(error);
  }
}

exports.getSingleDayReportJson = async (req, res, next) => {
  if (!req.params.day) {
    res.status(400).send("Report day not received");
  }
  try {
    const report = await axios({
      method: 'get',
      maxBodyLength: Infinity,
      url: (new URL(conf.getConfig().report.reportBackendBaseurl + conf.getConfig().report.getSingleDayReportJsonUrl.replace(":day", req.params.day))).href,
      auth: {
        username: conf.getConfig().report.username,
        password: conf.getConfig().report.password
      },
      headers: {
        'Content-Type': 'application/json'
      }
    }).catch(err => {
      if (err.response) {
        // client received an error response (5xx, 4xx)
        wlogger.error("Received error response while getting report json for date" + date); 
        wlogger.error(err);
      } else if (err.request) {
        // client never received a response, or request never left
        wlogger.error("No response received while checking getting report json for date " + date); 
        wlogger.error(err);
      } else {
        // anything else
        wlogger.error("Error while checking getting report json for date " + date); 
        wlogger.error(err);
      }
    });
    return res.status(200).json(report.data);
  } catch (error) {
    wlogger.error({ "ERROR get-single-day-report-json:": error });
    return res.status(500).json(error);
  }
}

exports.getReportJsonForPeriod = async (req, res, next) => {
  const startGenTime = new Date();  
  const groupColorShade = -20;
  const subGroupColorShade = -10;
  const startDate = getDateStr(req.body.startDate);
  const stopDate = getDateStr(req.body.stopDate);
  const period = req.body.period;
  const folder = req.body.folder;
  const filenameString = req.body.filenameString;
  wlogger.info("Received generation request of report for period: " + period + " - with startDate: " + startDate + " - with stopDate: " + stopDate + " - in folder: " + folder + " - using filenameString: " + filenameString);
  wlogger.info("Report generation started at: " + startGenTime.toISOString());

  // update productTypeList:
  let tempProductTypeListRes = await getProductTypeList();
  if (!tempProductTypeListRes) {
    return res.status(404).json("Report back-end not found");
  }
  productTypeList = tempProductTypeListRes.data;
  // update datasourcesMap:
  datasourcesMap = (await getDatasourcesMap()).data;
  
  const productTypeGroupList = productTypeList.map(el => el.group);
  const productTypeSubGroupList = productTypeList.map(el => el.subGroup);
  const fontFamily = "Calibri";
  const statsSheetsNumber = 5;     // number of first output sheet starting from 0
  const statsBWSheetsNumber = 7;   // number of first bandwidth output sheet starting from 0
  // Automatic first row calc per Mission.
  const firstRow = 3;
  const productRowsGroupsFirstRows = {};

  const outputPath = path.resolve(conf.getConfig().report.reportsStorageFolder, folder);
  await fs.mkdir(outputPath, { recursive: true });

  try {
    localCentre = await getLocalCentreName().catch(err => {
      if (err.response) {
        // client received an error response (5xx, 4xx)
        wlogger.error("Received error response while checking for local centre"); 
        wlogger.error(err);
      } else if (err.request) {
        // client never received a response, or request never left
        wlogger.error("No response received while checking for local centre"); 
        wlogger.error(err);
      } else {
        // anything else
        wlogger.error("Error while checking for local centre"); 
        wlogger.error(err);
      }
      throw err;
    });

    const body = {
      startDate: startDate,
      stopDate: stopDate
    }
    const report = await axios({
      method: 'post',
      maxBodyLength: Infinity,
      url: (new URL(conf.getConfig().report.reportBackendBaseurl + conf.getConfig().report.getReportJsonForPeriodUrl)).href,
      auth: {
        username: conf.getConfig().report.username,
        password: conf.getConfig().report.password
      },
      headers: {
        'Content-Type': 'application/json'
      },
      data: body
    }).catch(err => {
      if (err.response) {
        // client received an error response (5xx, 4xx)
        wlogger.error("Received error response while checking report for period " + startDate + " - " + stopDate); 
        wlogger.error(err);
      } else if (err.request) {
        // client never received a response, or request never left
        wlogger.error("No response received while checking report for period " + startDate + " - " + stopDate);
        wlogger.error(err);
      } else {
        // anything else
        wlogger.error("Error while checking report for period " + startDate + " - " + stopDate); 
        wlogger.error(err);
      }
      throw err;
    });
    const errorsArray = report.data.report_error;

    const retrievedStatsJsonData = getArraysFromResponseObject(report.data.report_content.retrievedStats);
    retrievedStatsJsonData.splice(0, 0, ["Retrieved Stats - Reporting Period: "+startDate+" to "+stopDate]);
    retrievedStatsJsonData.splice(1, 0, statsSheetsCols);
    const retrievedStatsJson = retrievedStatsJsonData;
    //wlogger.debug("retrievedStatsJson: " + JSON.stringify(retrievedStatsJson, null, 2));

    const distributedStatsJsonData = getArraysFromResponseObject(report.data.report_content.distributedStats);
    distributedStatsJsonData.splice(0, 0, ["Distributed Stats - Reporting Period: "+startDate+" to "+stopDate]);
    distributedStatsJsonData.splice(1, 0, statsSheetsCols);
    const distributedStatsJson = distributedStatsJsonData;
    //wlogger.debug("distributedStatsJson: " + JSON.stringify(distributedStatsJson, null, 2));

    const bandwidthStatsRetrievedJsonData = getArraysFromResponseObject(report.data.report_content.bandwidthRetrievedStats);
    bandwidthStatsRetrievedJsonData.splice(0, 0, ["Bandwidth Retrieved Stats - Reporting Period: "+startDate+" to "+stopDate]);
    bandwidthStatsRetrievedJsonData.splice(1, 0, statsBWSheetCols);
    const bandwidthStatsRetrievedJson = bandwidthStatsRetrievedJsonData;
    //wlogger.debug("bandwidthStatsRetrievedJson: " + JSON.stringify(bandwidthStatsRetrievedJson, null, 2));

    const bandwidthStatsDistributedJsonData = getArraysFromResponseObject(report.data.report_content.bandwidthDistributedStats);
    bandwidthStatsDistributedJsonData.splice(0, 0, ["Bandwidth Distributed Stats - Reporting Period: "+startDate+" to "+stopDate]);
    bandwidthStatsDistributedJsonData.splice(1, 0, statsBWSheetCols);
    const bandwidthStatsDistributedJson = bandwidthStatsDistributedJsonData;
    //wlogger.debug("bandwidthStatsDistributedJson: " + JSON.stringify(bandwidthStatsDistributedJson, null, 2));

    // Create Retrieved Output:
    const retrievedOutputJson = await createRetrievedOutputJson(retrievedStatsJson, startDate, stopDate);
    //wlogger.debug("retrievedOutputJson: " + JSON.stringify(retrievedOutputJson, null, 2));
    // Create Distributed Output:
    const distributedOutputJson = await createDistributedOutputJson(distributedStatsJson, startDate, stopDate);
    //wlogger.debug("distributedOutputJson: " + JSON.stringify(distributedOutputJson, null, 2));

    // Create Bandwidth Retrieved Output:
    const bandwidthRetrievedOutputJson = await createBandwidthRetrievedOutputJson(bandwidthStatsRetrievedJson, startDate, stopDate);
    //wlogger.debug("bandwidthRetrievedOutputJson: " + JSON.stringify(bandwidthRetrievedOutputJson, null, 2));
    // Create Bandwidth Distributed Output:
    const bandwidthDistributedOutputJson = await createBandwidthDistributedOutputJson(bandwidthStatsDistributedJson, startDate, stopDate);
    //wlogger.debug("bandwidthDistributedOutputJson: " + JSON.stringify(bandwidthDistributedOutputJson, null, 2));
    // Create Error Log Output:
    const errorLogOutputJson = await createErrorLogOutputJson(errorsArray);

    // Prepare workbook
    const workbook = XLSX.utils.book_new();
    let worksheetArr = [];
    if (checkArrayOfArrays(legendaJsonData)) {
      worksheetArr.push(XLSX.utils.aoa_to_sheet(legendaJsonData));
    } else {
      wlogger.info("legendaJsonData is not an array of arrays: ", legendaJsonData);
    }
    if (checkArrayOfArrays(retrievedStatsJson)) {
      worksheetArr.push(XLSX.utils.aoa_to_sheet(retrievedStatsJson));
    } else {
      wlogger.info("retrievedStatsJson is not an array of arrays: ", retrievedStatsJson);
    }
    if (checkArrayOfArrays(distributedStatsJson)) {
      worksheetArr.push(XLSX.utils.aoa_to_sheet(distributedStatsJson));
    } else {
      wlogger.info("distributedStatsJson is not an array of arrays: ", distributedStatsJson);
    }
    if (checkArrayOfArrays(bandwidthStatsRetrievedJson)) {
      worksheetArr.push(XLSX.utils.aoa_to_sheet(bandwidthStatsRetrievedJson));
    } else {
      wlogger.info("bandwidthStatsRetrievedJson is not an array of arrays: ", bandwidthStatsRetrievedJson);
    }
    if (checkArrayOfArrays(bandwidthStatsDistributedJson)) {
      worksheetArr.push(XLSX.utils.aoa_to_sheet(bandwidthStatsDistributedJson));
    } else {
      wlogger.info("bandwidthStatsDistributedJson is not an array of arrays: ", bandwidthStatsDistributedJson);
    }
    if (checkArrayOfArrays(retrievedOutputJson)) {
      worksheetArr.push(XLSX.utils.aoa_to_sheet(retrievedOutputJson));
    } else {
      wlogger.info("retrievedOutputJson is not an array of arrays: ", retrievedOutputJson);
    }
    if (checkArrayOfArrays(distributedOutputJson)) {
      worksheetArr.push(XLSX.utils.aoa_to_sheet(distributedOutputJson));
    } else {
      wlogger.info("distributedOutputJson is not an array of arrays: ", distributedOutputJson);
    }
    if (checkArrayOfArrays(bandwidthRetrievedOutputJson)) {
      worksheetArr.push(XLSX.utils.aoa_to_sheet(bandwidthRetrievedOutputJson));
    } else {
      wlogger.info("bandwidthOutputRetrievedJson is not an array of arrays: ", bandwidthRetrievedOutputJson);
    }
    if (checkArrayOfArrays(bandwidthDistributedOutputJson)) {
      worksheetArr.push(XLSX.utils.aoa_to_sheet(bandwidthDistributedOutputJson));
    } else {
      wlogger.info("bandwidthOutputDistributedJson is not an array of arrays: ", bandwidthDistributedOutputJson);
    }
    if (checkArrayOfArrays(errorLogOutputJson)) {
      worksheetArr.push(XLSX.utils.aoa_to_sheet(errorLogOutputJson));
    } else {
      wlogger.info("errorLogOutputJson is not an array of arrays: ", errorLogOutputJson);
    } 
    
    let worksheetObj = [
      {"sheetName": "Legenda", "json": legendaJsonData},
      {"sheetName": "Retrieved Stats", "json": retrievedStatsJson},
      {"sheetName": "Distributed Stats", "json": distributedStatsJson},
      {"sheetName": "Bandwidth Retrieved Stats", "json": bandwidthStatsRetrievedJson},
      {"sheetName": "Bandwidth Distributed Stats", "json": bandwidthStatsDistributedJson},
      {"sheetName": "Retrieved", "json": retrievedOutputJson},
      {"sheetName": "Distributed", "json": distributedOutputJson},
      {"sheetName": "Bandwidth Retrieved", "json": bandwidthRetrievedOutputJson},
      {"sheetName": "Bandwidth Distributed", "json": bandwidthDistributedOutputJson},
      {"sheetName": "Error Log", "json": errorLogOutputJson},
    ];

    // STYLING:
    worksheetArr.forEach((worksheet, wsIndex) => {

      // Set cell MERGES
      if (wsIndex == 0) {
        worksheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
      } else if (wsIndex < statsSheetsNumber && wsIndex > 0) {
        // Merge first row cells to center title
        worksheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: statsSheetsCols.length - (wsIndex < statsSheetsNumber - 2 ? 1 : 2) } }];
      } else if (wsIndex >= statsSheetsNumber && wsIndex < statsBWSheetsNumber) {
        // Merge header cells in output sheets:
        worksheet["!merges"] = [];
        worksheetObj[wsIndex]['json'][1].forEach((colObj, c) => {
          if (c > 0 && c%2==0) {
            worksheet["!merges"].push({ s: { r: 1, c: c-1 }, e: { r: 1, c: c } });
          }
        });
        worksheet["!merges"].push({ s: { r: 0, c: 0 }, e: { r: 0, c: (datasourcesMap.length * 2) } });
      } else if (wsIndex >= statsBWSheetsNumber && wsIndex < statsBWSheetsNumber + 2) {
        // Merge first row cells to center title
        worksheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: datasourcesMap.length } }];
      }

      // calc each worksheet RANGE
      const range = XLSX.utils.decode_range(worksheet["!ref"]);
      let headerStyle = {};
      let rowStyle = {};
      let fontSize = 11;
      worksheet["!rows"] = [];
      for (let row = range.s.r; row <= range.e.r; ++row) {

        // Make Product-type-row bigger
        if (wsIndex == 0 && row > 1) {
          worksheet["!rows"].push({ hpt: 110 });
        } else if (wsIndex >= statsSheetsNumber && wsIndex < statsBWSheetsNumber + 2 && row == 2) {
          worksheet["!rows"].push({ hpt: 26 });
        } else {
          worksheet["!rows"].push({ hpt: 16 });
        }

        for (let col = range.s.c; col <= range.e.c; ++col) {
          const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
          if (!worksheet[cellRef]) continue;

          // Styling
          if (wsIndex == 0) {                                                                                     // --- Legenda Sheet ---
            fontSize = 10;
            headerStyle = {
              font: { name: fontFamily, sz: fontSize, bold: true, color: { rgb: "000000" } },
              alignment: { wrapText: true, horizontal: "center", vertical: "center" },
              fill: {fgColor: {rgb: shadeColor(datasourceColorArr[0], subGroupColorShade)}},
              border: {top: {style: row==0 ? "medium" : "thin"}, bottom: {style: row==1 ? "medium" : "normal"}, left: {style: col==0 ? "medium" : "normal"}, right: {style: col>0 ? "medium" : "thin"}}
            };
            rowStyle = {
              font: { name: fontFamily, sz: fontSize, bold: col == 0 ? true : false, color: { rgb: "000000" } },
              alignment: { wrapText: true, horizontal: "left", vertical: "top" },
              border: {left: {style: col==0 ? "medium" : "normal"}, right: {style: col>0 ? "medium" : "normal"}, bottom: {style: row == range.e.r ? "medium" : "normal"}}
            };
          } else if (wsIndex < statsSheetsNumber && wsIndex > 0) {                                                 // --- Stats Sheets ---
            fontSize = 10;
            headerStyle = {
              font: { name: fontFamily, sz: fontSize, bold: true, color: { rgb: "000000" } },
              alignment: { wrapText: true, horizontal: "center", vertical: "center" },
              fill: {fgColor: {rgb: shadeColor(datasourceColorArr[0], subGroupColorShade)}},
              border: {top: {style: row==0 ? "medium" : "thin"}, bottom: {style: row==1 ? "medium" : "normal"}, left: {style: col==0 ? "medium" : "normal"}, right: {style: col<range.e.c ? "thin" : "medium"}}
            };
            rowStyle = {
              font: { name: fontFamily, sz: fontSize, bold: false, color: { rgb: "000000" } },
              alignment: { horizontal: "left", vertical: "center" },
              border: {left: {style: col==0 ? "medium" : "normal"}, right: {style: col<range.e.c ? "normal" : "medium"}, bottom: {style: row == range.e.r ? "medium" : "normal"}}
            };
          } else if (wsIndex >= statsSheetsNumber && wsIndex < statsBWSheetsNumber) {                              // --- Output Sheets ---
            fontSize = 8;
            if (row == 0) {
              headerStyle = {
                font: { name: fontFamily, sz: fontSize, bold: true, color: { rgb: "000000" } },
                alignment: { wrapText: true, horizontal: "center", vertical: "center" },
                fill: {fgColor: {rgb: shadeColor(datasourceColorArr[0], groupColorShade)}},
                border: {right: {style: col==0 ? "thick" : "medium"}}
              }
            } else if (row == 1) {
              headerStyle = {
                font: { name: fontFamily, sz: fontSize, bold: true, color: { rgb: "000000" } },
                alignment: { wrapText: true, horizontal: "center", vertical: "center" },
                fill: {fgColor: {rgb: (col==0 ? shadeColor(datasourceColorArr[col], subGroupColorShade) : datasourceColorArr[Math.floor((col+1)/2)])}},
                border: {bottom: {style: "medium"}, right: {style: col==0 ? "thick" : "medium"}, top: {style: "medium"}}
              }
            } else if (row == 2) {
              rowStyle = {
                font: { name: fontFamily, sz: fontSize, bold: true, color: { rgb: "000000" } },
                alignment: { wrapText: true, horizontal: "center", vertical: "center" },
                fill: {fgColor: {rgb: (col==0 ? shadeColor(datasourceColorArr[col], subGroupColorShade) : datasourceColorArr[Math.floor((col+1)/2)])}},
                border: {bottom: {style: "medium"}, right: {style: col==0 ? "thick" : (col%2 == 1 ? "thin": "medium")}}
              };
            } else {
              const encodedCell = worksheet[XLSX.utils.encode_cell({ r: row, c: 0 })];
              if (encodedCell && productTypeGroupList.includes(encodedCell.v)) {
                if (col == 0) {
                  rowStyle = {
                    font: { name: fontFamily, sz: fontSize, bold: true, color: { rgb: "000000" } },
                    alignment: { horizontal: "center", vertical: "center"},
                    fill: {fgColor: {rgb: shadeColor(datasourceColorArr[col], groupColorShade)}},
                    border: {bottom: {style: "thin"}, right: {style: "thick"}, top: {style: "medium"}}
                  };
                } else {
                  rowStyle = {
                    font: { name: fontFamily, sz: fontSize, bold: true, color: { rgb: "000000" } },
                    alignment: { horizontal: "right", vertical: "center"},
                    fill: {fgColor: {rgb: (col==0 ? datasourceColorArr[col] : shadeColor(datasourceColorArr[Math.floor((col+1)/2)], groupColorShade) )}},
                    border: {bottom: {style: "thin"}, right: {style: (col%2 == 1 ? "thin": "medium")}, top: {style: "medium"}}
                  };
                }
              } else if (encodedCell && productTypeSubGroupList.includes(encodedCell.v)) {
                if (col == 0) {
                  rowStyle = {
                    font: { name: fontFamily, sz: fontSize, bold: true, color: { rgb: "000000" } },
                    alignment: { horizontal: "left", vertical: "center" },
                    fill: {fgColor: {rgb: shadeColor(datasourceColorArr[col], subGroupColorShade)}},
                    border: {bottom: {style: "thin"}, right: {style: "thick"}}
                  };
                } else {
                  rowStyle = {
                    font: { name: fontFamily, sz: fontSize, bold: true, color: { rgb: "000000" } },
                    alignment: { horizontal: "right", vertical: "center" },
                    fill: {fgColor: {rgb: (col==0 ? datasourceColorArr[col] : shadeColor(datasourceColorArr[Math.floor((col+1)/2)], subGroupColorShade))}},
                    border: {bottom: {style: "thin"}, right: {style: (col%2 == 1 ? "thin": "medium")}}
                  };
                }
              } else {
                if (col == 0) {
                  rowStyle = {
                    font: { name: fontFamily, sz: fontSize, bold: false, color: { rgb: "000000" } },
                    alignment: { horizontal: "left", vertical: "center" },
                    fill: {fgColor: {rgb: datasourceColorArr[col]}},
                    border: {bottom: {style: "thin"}, right: {style: "thick"}}
                  };
                } else {
                  rowStyle = {
                    font: { name: fontFamily, sz: fontSize, bold: false, color: { rgb: "000000" } },
                    alignment: { horizontal: "right", vertical: "center" },
                    fill: {fgColor: {rgb: (col==0 ? datasourceColorArr[col] : datasourceColorArr[Math.floor((col+1)/2)])}},
                    border: {bottom: {style: "thin"}, right: {style: (col%2 == 1 ? "thin": "medium")}}
                  };
                }
              }
            }
          } else if (wsIndex >= statsBWSheetsNumber && wsIndex < statsBWSheetsNumber + 2) {                                 // --- Last Bandwidth Sheet ---
            fontSize = 8;
            if (row == 0) {
              headerStyle = {
                font: { name: fontFamily, sz: fontSize, bold: true, color: { rgb: "000000" } },
                alignment: { wrapText: true, horizontal: "center", vertical: "center" },
                fill: {fgColor: {rgb: shadeColor(datasourceColorArr[0], groupColorShade)}},
                border: {bottom: {style: "medium"}, right: {style: "medium"}}
              }
            } else if (row == 1) {
              headerStyle = {
                font: { name: fontFamily, sz: fontSize, bold: true, color: { rgb: "000000" } },
                alignment: { wrapText: true, horizontal: "center", vertical: "center" },
                fill: {fgColor: {rgb: (col==0 ? shadeColor(datasourceColorArr[col], subGroupColorShade) : datasourceColorArr[col])}},
                border: {bottom: {style: "medium"}, right: {style: "medium"}}
              }
            } else if (row == 2) {
              rowStyle = {
                font: { name: fontFamily, sz: fontSize, bold: true, color: { rgb: "000000" } },
                alignment: { wrapText: true, horizontal: "center", vertical: "center" },
                fill: {fgColor: {rgb: (col==0 ? shadeColor(datasourceColorArr[col], subGroupColorShade) : datasourceColorArr[col])}},
                border: {bottom: {style: "medium"}, right: {style: "medium"}}
              };
            } else {
              const encodedCell = worksheet[XLSX.utils.encode_cell({ r: row, c: 0 })];
              if (encodedCell && productTypeGroupList.includes(encodedCell.v)) {
                if (col == 0) {
                  rowStyle = {
                    font: { name: fontFamily, sz: fontSize, bold: true, color: { rgb: "000000" } },
                    alignment: { horizontal: "center", vertical: "center"},
                    fill: {fgColor: {rgb: shadeColor(datasourceColorArr[col], groupColorShade)}},
                    border: {bottom: {style: "thin"}, right: {style: "thick"}, top: {style: "medium"}}
                  };
                } else {
                  rowStyle = {
                    font: { name: fontFamily, sz: fontSize, bold: true, color: { rgb: "000000" } },
                    alignment: { horizontal: "right", vertical: "center"},
                    fill: {fgColor: {rgb: shadeColor(datasourceColorArr[col], groupColorShade)}},
                    border: {bottom: {style: "thin"}, right: {style: "medium"}, top: {style: "medium"}}
                  };
                }
              } else if (encodedCell && productTypeSubGroupList.includes(encodedCell.v)) {
                if (col == 0) {
                  rowStyle = {
                    font: { name: fontFamily, sz: fontSize, bold: true, color: { rgb: "000000" } },
                    alignment: { horizontal: "left", vertical: "center" },
                    fill: {fgColor: {rgb: shadeColor(datasourceColorArr[col], subGroupColorShade)}},
                    border: {bottom: {style: "thin"}, right: {style: "thick"}}
                  };
                } else {
                  rowStyle = {
                    font: { name: fontFamily, sz: fontSize, bold: true, color: { rgb: "000000" } },
                    alignment: { horizontal: "right", vertical: "center" },
                    fill: {fgColor: {rgb: shadeColor(datasourceColorArr[col], subGroupColorShade)}},
                    border: {bottom: {style: "thin"}, right: {style: "medium"}}
                  };
                }
              } else {
                if (col == 0) {
                  rowStyle = {
                    font: { name: fontFamily, sz: fontSize, bold: false, color: { rgb: "000000" } },
                    alignment: { horizontal: "left", vertical: "center" },
                    fill: {fgColor: {rgb: datasourceColorArr[col]}},
                    border: {bottom: {style: "thin"}, right: {style: "thick"}}
                  };
                } else {
                  rowStyle = {
                    font: { name: fontFamily, sz: fontSize, bold: false, color: { rgb: "000000" } },
                    alignment: { horizontal: "right", vertical: "center" },
                    fill: {fgColor: {rgb: datasourceColorArr[col]}},
                    border: {bottom: {style: "thin"}, right: {style: "medium"}}
                  };
                }
              }
            }
          } else {
            fontSize = 8;
            if (row == 0) {
              headerStyle = {
                font: { name: fontFamily, sz: fontSize, bold: true, color: { rgb: "000000" } },
                alignment: { wrapText: true, horizontal: "center", vertical: "center" },
                fill: {fgColor: {rgb: shadeColor(datasourceColorArr[0], groupColorShade)}},
                border: {bottom: {style: "medium"}, right: {style: "medium"}}
              }
            } else {
              rowStyle = {
                font: { name: fontFamily, sz: fontSize, bold: false, color: { rgb: "000000" } },
                alignment: { wrapText: true, horizontal: "center", vertical: "center" },
                border: {bottom: {style: "medium"}, right: {style: "medium"}}
              };
            }
          }

          // Insert formulas for output sheets:
          if (wsIndex >= statsSheetsNumber && wsIndex < statsBWSheetsNumber + 2) {
            if (col > 0) {
              // skip first 3 rows of header and assign type = number to the rest
              if (row >= firstRow) worksheet[cellRef].t = "n";
              for (const [key, value] of Object.entries(productRowsGroupsFirstRows)) {

                let tempMissionObj = Object.keys(productRowsSubGroupsProductsNumber).filter(rowKey => rowKey.includes(key));
                let numOfPlatforms = tempMissionObj.length;

                // Create formula to sum plaform numbers for every mission:
                if (row == value && key != "S5") {
                  let tempFormulaString = ""+XLSX.utils.encode_cell({ r: row+1, c: col});
                  let platformSum = 0;
                  for (let k = 0; k < numOfPlatforms - 1; k++) {
                    platformSum += productRowsSubGroupsProductsNumber[tempMissionObj[k]];
                    tempFormulaString += "+"+XLSX.utils.encode_cell({r: row + platformSum + (k+2), c: col})
                  }
                  worksheet[cellRef] = {f: tempFormulaString};
                }

                // Create formula to sum values for every platform:
                if (row == value + (key == "S5" ? 0 : 1)) {
                  let tempFormulaString = "SUM("+XLSX.utils.encode_range({ s: { c: col, r: row+1 }, e: { c: col, r: row + productRowsSubGroupsProductsNumber[tempMissionObj[0]] } })+")";
                  worksheet[cellRef] = {f: tempFormulaString};
                }
                for (let k = 0; k < numOfPlatforms-1; k++) {
                  let tempAcc = 0;
                  for (let j = 0; j <= k; j++) {
                    tempAcc += productRowsSubGroupsProductsNumber[tempMissionObj[j]];
                  }
                  if (row == value + tempAcc + (k+2)) {
                    let tempFormulaString = "SUM("+XLSX.utils.encode_range({ s: { c: col, r: row + 1 }, e: { c: col, r: row + productRowsSubGroupsProductsNumber[tempMissionObj[k+1]] } })+")";
                    worksheet[cellRef] = {f: tempFormulaString};
                  }
                }
              }
            }
          } else if (wsIndex == statsSheetsNumber - 1) {
            if (col == 5) {
              if (row >= firstRow - 1) worksheet[cellRef].t = "n";
            }
          } else {
            if (col == 4) {
              if (row >= firstRow - 1) worksheet[cellRef].t = "n";
            }
          }

          // Fix float decimal separator:
          if (wsIndex == 1 || wsIndex == 2) {
            // RetrievedStats && DistributedStats
            if (col == 5 && row > 1) {
              worksheet[cellRef].t = 'n';
            }
          } else if (wsIndex == 3 || wsIndex == 4) {
            // RetrievedBandwidthStats && DistributedBandwidthStats
            if (col == 4 && row > 1) {
              worksheet[cellRef].t = 'n';
            }
          }

          // Apply header or row styles
          if (wsIndex == 0) {
            worksheet[cellRef].s = (row < 2 ? headerStyle : rowStyle);
          } else if (wsIndex < statsBWSheetsNumber + 2) {
            worksheet[cellRef].s = (row < 2 ? headerStyle : rowStyle);
          } else {
            worksheet[cellRef].s = (row < 1 ? headerStyle : rowStyle);
          }
        }
      }

      // Special styling for header borders:
      let lastMergedCol = wsIndex == 0 ? 1 : wsIndex < (statsSheetsNumber - 2) ? 5 : wsIndex < statsSheetsNumber ? 4 : wsIndex < statsBWSheetsNumber ? (datasourcesMap.length * 2) : wsIndex < statsBWSheetsNumber + 2 ? (datasourcesMap.length) : 1;
      const mergedHeaderEndCell = XLSX.utils.encode_cell({ r: 0, c: lastMergedCol });
      // create cell if missing, then apply border
      const endCell = ensureCell(worksheet, mergedHeaderEndCell);
      endCell.s = endCell.s || {};
      endCell.s.border = endCell.s.border || {};
      endCell.s.border.right = { style: "medium", color: { rgb: "000000" } };

      // Special styling for last two rows with totals:
      if (wsIndex >= statsSheetsNumber && wsIndex < statsBWSheetsNumber + 2) {
        for (let col = range.s.c; col <= range.e.c; ++col) {
          // Style second-last row:
          const cellRef = XLSX.utils.encode_cell({ r: range.e.r - 1, c: col });
          if (cellRef && worksheet[cellRef]) {
            worksheet[cellRef].s = {
              font: { name: fontFamily, sz: fontSize, bold: true, color: { rgb: "000000" } },
              alignment: { horizontal: "right", vertical: "center"},
              fill: { fgColor: {rgb: shadeColor(datasourceColorArr[wsIndex >= statsBWSheetsNumber ? col : Math.floor((col+1)/2)], subGroupColorShade)}},
              border: { right: {style: "thick"}, top: {style: "medium"}, bottom: {style: "medium"}}
            }
          }
          // Style last row:
          const cellRefLast = XLSX.utils.encode_cell({ r: range.e.r, c: col });
          if (cellRefLast && worksheet[cellRefLast]) {
            worksheet[cellRefLast].s = {
              font: { name: fontFamily, sz: fontSize, bold: true, color: { rgb: "000000" } },
              alignment: { horizontal: "right", vertical: "center"},
              fill: { fgColor: {rgb: shadeColor(datasourceColorArr[0], groupColorShade)}},
              border: { right: {style: "thick"}, top: {style: "medium"}, bottom: {style: "medium"}}
            }
          }
        }
      }

      // Automatic col width:
      let tempColWidthArr = [];
      worksheetObj[wsIndex]['json'].forEach((row, index) => {
        Object.keys(row).forEach((key, col) => {
          const maxValueLength = worksheetObj[wsIndex]['json'].reduce((w, r) => {
            const cellValue = r[key] ? r[key].toString() : "";
            return Math.max(w, cellValue.length);
          }, 0);

          const headerLength = key.length;
          let finalWidth = Math.max(headerLength, maxValueLength, 10);
          if (finalWidth > 100) finalWidth = 100;
          if (col == 0) {
            if (wsIndex < statsSheetsNumber && wsIndex > 0) {
              finalWidth = finalWidth / 1.5;  
            } else {
              finalWidth = finalWidth / 2;
            }
          } else {
            if (wsIndex >= statsSheetsNumber && wsIndex < statsBWSheetsNumber) {
              finalWidth = Math.ceil(finalWidth/2);
              if (finalWidth%2 == 1) finalWidth += 1;
            }
          }
          if (tempColWidthArr[col] && tempColWidthArr[col].hasOwnProperty('wch')) {
            if (tempColWidthArr[col]['wch'] < finalWidth * fontSize/11 + 2) {
              tempColWidthArr[col] = { wch: (col == 0 ? (wsIndex > 0 && wsIndex < statsSheetsNumber ? 48 : 30) : finalWidth * fontSize/11 + 2) };
            }
          } else {
            tempColWidthArr.push({ wch: (col == 0 ? (wsIndex > 0 && wsIndex < statsSheetsNumber ? 48 : 30) : finalWidth * fontSize/11 + 2) });
          }
        });
      });
      worksheet["!cols"] = tempColWidthArr;
      // Assign sheets to workbook:
      XLSX.utils.book_append_sheet(workbook, worksheet, worksheetObj[wsIndex]['sheetName']);
    });
    // Color output tabs:
    try {
      let filename = "";
      switch (period) {
        case "Week":
          // '2024_W48_report.xlsx'
          filename = path.join(outputPath, filenameString+".xlsx");
          break;
        case "Month":
          // '2024_M01_report.xlsx'
          filename = path.join(outputPath, filenameString+".xlsx");
          break;
        case "Year":
          // '2024_annual_report.xlsx'
          filename = path.join(outputPath, filenameString+".xlsx");
          break;
        case "Custom":
          // '2025-02-23_2025-05-22_report.xlsx'
          filename = path.join(outputPath, startDate+"_"+stopDate+""+filenameString+".xlsx");
          break;
      }
      const fileWritten = await addTabColor(workbook, [{name: "Retrieved", color: "ffdddd60"}, {name: "Distributed", color: "ffdddd20"}, {name: "Bandwidth Retrieved", color: "ff9bbb59"}, {name: "Bandwidth Distributed", color: "ff9bbb59"}, {name: "Error Log", color: "ffc0504d"}], filename);
      const endGenTime = new Date();
      wlogger.info("Report generation finished at: " + endGenTime.toISOString() + ". It took " + (endGenTime.getTime() - startGenTime.getTime()) + "ms to be produced.");

      switch (fileWritten.status) {
        case "written":
          wlogger.info("The output file has been created: " + filename);
          if (errorsArray.length > 0) {
            wlogger.warn("DEV - errorsArray: " + JSON.stringify(errorsArray, null, 2));
            return res.status(200).json({
              status: "success",
              message: errorsArray,
              filename: filename
            });
          }
          return res.status(200).json({
            status: "success",
            message: "",
            filename: filename
          });
        case "exists":
          wlogger.warn("The output file already exists: " + filename);
          return res.status(200).json({
            status: "warning",
            message: "",
            filename: filename
          });
        default:
          wlogger.warn("There was an unexpected error writing the file: " + filename);
          if (errorsArray.length > 0) {
            return res.status(200).json({
              status: "error",
              message: errorsArray,
              filename: filename
            });
          }
          return res.status(200).json({
            status: "error",
            message: [{
              "date": "",
              "errorSource": "output",
              "errorType": "error",
              "errorMessage": "Unknown error while generating the output file: " + filename
            }],
            filename: filename
          });
      }
    } catch (e) {
      wlogger.error("Error: " + JSON.stringify(e, null, 2));
    }
    wlogger.info("SUCCESS:<br>The output file has been correctly created");
    return res.status(200).json("SUCCESS:<br>The output file has been correctly created.");
  } catch (error) {
    wlogger.error("ERROR getting report for period: " + error + " with code: " + error.code);
    if (error.code === "ECONNREFUSED") {
      wlogger.error("There was a problem conneting to the report back end");
    } else if (error.status === 403) { 
      wlogger.error("The back-end ip is not authorized. Please check the report-back-end config file.");
      return res.status(403).json(error);
    }
    return res.status(500).json(error);
  }
}

async function addTabColor(workbook, sheetNameColorArr, outputFile) {
  // Create XLSX buffer in memory
  const buf = XLSX.write(workbook, { type: "array", bookType: "xlsx", compression: true });

  // Open zip
  const zip = await JSZip.loadAsync(buf);

  // Read workbook.xml
  const workbookPath = "xl/workbook.xml";
  const workbookXml = await zip.file(workbookPath).async("string");

  for(let sheetName of sheetNameColorArr) {
    // Find rId of the sheet with that name
    const sheetMatch = workbookXml.match(new RegExp(`<sheet[^>]*name="${escapeRegExp(sheetName.name)}"[^>]*r:id="([^"]+)"[^>]*\\/?>`));
    if (!sheetMatch) {
      wlogger.info("Sheet name not found in workbook.xml: " + sheetName.name);
      continue;
    }
    const rId = sheetMatch[1];

    // Read rels to map rId -> target
    const relsPath = "xl/_rels/workbook.xml.rels";
    const relsXml = await zip.file(relsPath).async("string");
    const relMatch = relsXml.match(new RegExp(`<Relationship[^>]*Id="${rId}"[^>]*Target="([^"]+)"`));
    if (!relMatch) throw new Error("rId not found in workbook.xml.rels: " + rId);
    const target = relMatch[1]; // es. "worksheets/sheet2.xml"
    const worksheetPath = `xl/${target}`;

    // Read worksheet xml
    let worksheetXml = await zip.file(worksheetPath).async("string");

    // If already exists sheetPr/tabColor, substitute or avoid duplicates
    if (/\<sheetPr[^\>]*\>[\s\S]*?<\/sheetPr\>/i.test(worksheetXml)) {
      // Substitute tabColor inside sheetPr if present, or insert tabColor inside sheetPr
      if (/\<sheetPr[\s\S]*\<tabColor/i.test(worksheetXml)) {
        worksheetXml = worksheetXml.replace(/\<sheetPr([\s\S]*?)\<tabColor[^>]*\/\>([\s\S]*?)<\/sheetPr\>/i,
          (m, p1, p2) => `<sheetPr${p1}<tabColor rgb="${sheetName.color}"/>${p2}</sheetPr>`);
      } else {
        worksheetXml = worksheetXml.replace(/\<sheetPr([\s\S]*?)\>/i, `<sheetPr$1><tabColor rgb="${sheetName.color}"/>`);
      }
    } else {
      // Insert a new sheetPr right after the opening tag <worksheet ...>
      worksheetXml = worksheetXml.replace(/(<worksheet[^>]*>)/i, `$1<sheetPr><tabColor rgb="${sheetName.color}"/></sheetPr>`);
    }

    // Save edited zip file
    zip.file(worksheetPath, worksheetXml);
  };

  // Generate a new buffer and write on disk
  const newBuf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  try {
    await fs.writeFile(outputFile, newBuf, { flag: 'wx' });
    return {"status": "written"};
  } catch(err) {
    if (err.code === 'EEXIST') {
      wlogger.warn('Warning: Report file already exists. Skipping');
      return {"status": "exists"};
    } else {
      wlogger.error(err);
      return {"status": err};
    }
  }
}

exports.getReportFileStructure = async (req, res, next) => {
  const reportsFolder = conf.getConfig().report.reportsStorageFolder;
  wlogger.debug("DEV - getReportFileStructure - folder name: " + reportsFolder);
  await fs.mkdir(reportsFolder, { recursive: true });
  let reportListTest = {
    name: reportsFolder, // Parent folder
    type: 'folder',
    url: '',
    contents: []
  };
  const reportsStorageFolder = conf.getConfig().report.reportsStorageFolder;
  const basePath = path.join(process.cwd(), reportsStorageFolder);

  const readFoldersRecursive = async (folderName, parentObj) => {
    const entries = await fs.readdir(folderName, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        // There is a subfolder
        parentObj.contents.push({
          name: entry.name,
          type: 'folder',
          url: '',
          contents: []
        });

        // Check for subfolders
        const fullPath = path.join(folderName, entry.name);
        await readFoldersRecursive(fullPath, parentObj.contents[parentObj.contents.length - 1]);
      } else {
        parentObj.contents.push({
          name: entry.name,
          type: 'file',
          url: entry.name
        });
      }
    }
  };

  await readFoldersRecursive(basePath, reportListTest);

  return res.status(200).json(reportListTest);
}

exports.downloadReport = async (req, res, next) => {
  if (!req.body.filename) {
    res.status(400).send("Report filename not received");
  }
  const filename = req.body.filename;
  const reportsStorageFolder = conf.getConfig().report.reportsStorageFolder;
  const filePath = await findFileRecursive(reportsStorageFolder, filename);
  wlogger.info("Requested Report download with file path: ", filePath);
  
  res.download(filePath, filename, err => {
    if (err) {
      console.error(err);
      res.status(404).send('File not found');
    }
  });
};

async function findFileRecursive(dir, filename) {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      const found = await findFileRecursive(fullPath, filename);
      if (found) return found;
    } else if (entry.isFile() && entry.name === filename) {
      return fullPath;
    }
  }

  return null;
};

function getArraysFromResponseObject(responseObjArr) {
  let outputArr = [];
  responseObjArr.forEach((resObj) => {
    if (resObj.hasOwnProperty('size') && resObj.size != null) resObj.size = resObj.size.toFixed(6);
    if (resObj.hasOwnProperty('bandwidth') && resObj.bandwidth != null) resObj.bandwidth = resObj.bandwidth.toFixed(6);
    outputArr.push(Object.values(resObj));
  });

  return outputArr;
}

async function createRetrievedOutputJson(retrievedStatsJson, startDate, stopDate) {
  wlogger.info("Generating Retrieved output sheet");
  // Header
  let tempRetrievedOutputJson = [["Retrieved Output - Reporting Period: "+startDate+" to "+stopDate], ["Centre: "+localCentre], ["Product Type"]];
  let subHeaderTemp = [
    "No. of products \nretrieved", "Size of products \nretrieved [TiB]"
  ];

  // update datasourcesMap:
  datasourcesMap = (await getDatasourcesMap()).data;
  console.log("datasourcesMap: ", datasourcesMap);

  datasourcesMap.forEach(datasource => {
    tempRetrievedOutputJson[1].push("from "+datasource.name, "");
    tempRetrievedOutputJson[2].push(...subHeaderTemp);
  });

  // update productTypeFamilyList:
  productTypeFamilyList = (await getProductTypeFamilyList()).data;

  // Body
  let productsDescriptionArr = productTypeFamilyList.sort((a, b) => {
    const groupCompare = a.group.localeCompare(b.group);
    if (groupCompare !== 0) return groupCompare;
    return a.subGroup.localeCompare(b.subGroup);
  });
  let tempDescGroupPrec = "";
  let tempDescSubGroupPrec = "";
  let tempTotalRowArr = ["TOTAL RETRIEVED BY DHR (NB | TiB):"];
  let tempFinalTotalRowArr = ["TOTAL RETRIEVED (NB | TiB):"];
  let sumNum = new Array(datasourcesMap.length).fill(0);
  let sumSize = new Array(datasourcesMap.length).fill(0);
  productsDescriptionArr.forEach(productObj => {
    const tempDescGroup = productObj.group;
    const tempDescSubGroup = productObj.subGroup;
    
    // Insert Group Name
    let tempGroupProductArr = [productObj.group];
    if (tempDescGroup !== tempDescGroupPrec) {
      datasourcesMap.forEach(datasource => {
        tempGroupProductArr.push(0);
        tempGroupProductArr.push(0);
      });
      tempRetrievedOutputJson.push(tempGroupProductArr);
    }

    // Insert SubGroup Name (not for S5P)
    if (productObj.group !== "SENTINEL 5P") {
      let tempSubGroupProductArr = [productObj.subGroup];
      if (tempDescSubGroup !== tempDescSubGroupPrec) {
        datasourcesMap.forEach(datasource => {
          tempSubGroupProductArr.push(0);
          tempSubGroupProductArr.push(0);
        });
        tempRetrievedOutputJson.push(tempSubGroupProductArr);
      }
    }

    // Insert Product Type (or description, if present)
    let tempProductFamilyArr = [(productObj.description == "" ? productObj.label : productObj.description)];
    datasourcesMap.forEach((datasource, dsIndex) => {
      let tempNbProducts = 0;
      let tempSizeProducts = 0;
      retrievedStatsJson.forEach((retrievedStat, index) => {
        // Skip first two rows of header
        if (index > 1 && retrievedStat[statsSheetsCols.indexOf('From')] === datasource.name) {
          if (retrievedStat[statsSheetsCols.indexOf('Product Type')].match(productObj.label)) {
            tempNbProducts += retrievedStat[statsSheetsCols.indexOf('NB Products')];
            tempSizeProducts += parseFloat(retrievedStat[statsSheetsCols.indexOf('Size (TiB)')]);
            sumNum[dsIndex] += retrievedStat[statsSheetsCols.indexOf('NB Products')];
            sumSize[dsIndex] += parseFloat(retrievedStat[statsSheetsCols.indexOf('Size (TiB)')]);
          }
        }
      })
      tempProductFamilyArr.push(tempNbProducts);
      tempProductFamilyArr.push(tempSizeProducts);
    });
    tempRetrievedOutputJson.push(tempProductFamilyArr);
    tempDescSubGroupPrec = tempDescSubGroup;
    tempDescGroupPrec = tempDescGroup;
  });

  // Add Total counts:
  for (let i = 0; i < datasourcesMap.length; i++) {
    tempTotalRowArr.push(sumNum[i]);
    tempTotalRowArr.push(sumSize[i] != null ? sumSize[i].toFixed(6) : -1);
  }
  tempFinalTotalRowArr.push(sumNum.reduce((a, b) => a + b, 0));
  tempFinalTotalRowArr.push(sumSize.reduce((a, b) => a + b, 0));
  return tempRetrievedOutputJson.concat([tempTotalRowArr]).concat([tempFinalTotalRowArr]);
}

async function createDistributedOutputJson(distributedStatsJson, startDate, stopDate) {
  wlogger.info("Generating Distributed output sheet");
  // Header
  let tempDistributedOutputJson = [["Distributed Output - Reporting Period: "+startDate+" to "+stopDate], ["Centre: "+localCentre], ["Product Type"]];
  let subHeaderTemp = [
    "No. of products \ndistributed", "Size of products \ndistributed [TiB]"
  ];

  // update datasourcesMap:
  datasourcesMap = (await getDatasourcesMap()).data;
  

  datasourcesMap.forEach(datasource => {
    tempDistributedOutputJson[1].push("to "+datasource.name, "");
    tempDistributedOutputJson[2].push(...subHeaderTemp);
  });

  // update productTypeFamilyList:
  productTypeFamilyList = (await getProductTypeFamilyList()).data;

  // Body
  let productsDescriptionArr = productTypeFamilyList.sort((a, b) => {
    const groupCompare = a.group.localeCompare(b.group);
    if (groupCompare !== 0) return groupCompare;
    return a.subGroup.localeCompare(b.subGroup);
  });
  let tempDescGroupPrec = "";
  let tempDescSubGroupPrec = "";
  let tempTotalRowArr = ["TOTAL DISTRIBUTED BY DHR (NB | TiB):"];
  let tempFinalTotalRowArr = ["TOTAL DISTRIBUTED (NB | TiB):"];
  let sumNum = new Array(datasourcesMap.length).fill(0);
  let sumSize = new Array(datasourcesMap.length).fill(0);
  productsDescriptionArr.forEach(productObj => {
    const tempDescGroup = productObj.group;
    const tempDescSubGroup = productObj.subGroup;
    
    // Insert Group Name
    let tempGroupProductArr = [productObj.group];
    if (tempDescGroup !== tempDescGroupPrec) {
      datasourcesMap.forEach(datasource => {
        tempGroupProductArr.push(0);
        tempGroupProductArr.push(0);
      });
      tempDistributedOutputJson.push(tempGroupProductArr);
    }

    // Insert SubGroup Name
    if (productObj.group !== "SENTINEL 5P") {
      let tempSubGroupProductArr = [productObj.subGroup];
      if (tempDescSubGroup !== tempDescSubGroupPrec) {
        datasourcesMap.forEach(datasource => {
          tempSubGroupProductArr.push(0);
          tempSubGroupProductArr.push(0);
        });
        tempDistributedOutputJson.push(tempSubGroupProductArr);
      }
    }

    // Insert Product Type (or description, if present)
    let tempProductFamilyArr = [(productObj.description == "" ? productObj.label : productObj.description)];
    datasourcesMap.forEach((datasource, dsIndex) => {
      let tempNbProducts = 0;
      let tempSizeProducts = 0;
      distributedStatsJson.forEach((distributedStat, index) => {
        // Skip first two rows of header
        if (index > 1 && distributedStat[statsSheetsCols.indexOf('To')] === datasource.name) {
          if (distributedStat[statsSheetsCols.indexOf('Product Type')].match(productObj.label)) {
            tempNbProducts += distributedStat[statsSheetsCols.indexOf('NB Products')];
            tempSizeProducts += parseFloat(distributedStat[statsSheetsCols.indexOf('Size (TiB)')]);
            sumNum[dsIndex] += distributedStat[statsSheetsCols.indexOf('NB Products')];
            sumSize[dsIndex] += parseFloat(distributedStat[statsSheetsCols.indexOf('Size (TiB)')]);
          }
        }
      })
      tempProductFamilyArr.push(tempNbProducts);
      tempProductFamilyArr.push(tempSizeProducts);
    });
    tempDistributedOutputJson.push(tempProductFamilyArr);
    tempDescSubGroupPrec = tempDescSubGroup;
    tempDescGroupPrec = tempDescGroup;
  });

  // Add Total counts:
  for (let i = 0; i < datasourcesMap.length; i++) {
    tempTotalRowArr.push(sumNum[i]);
    tempTotalRowArr.push(sumSize[i] != null ? sumSize[i].toFixed(6) : -1);
  }
  tempFinalTotalRowArr.push(sumNum.reduce((a, b) => a + b, 0));
  tempFinalTotalRowArr.push(sumSize.reduce((a, b) => a + b, 0));
  return tempDistributedOutputJson.concat([tempTotalRowArr]).concat([tempFinalTotalRowArr]);
}

async function createBandwidthRetrievedOutputJson(bandwidthStatsJson, startDate, stopDate) {
  wlogger.info("Generating Bandwidth Retrieved output sheet");
  // Header
  let tempBandwidthOutputJson = [["Retrieved Bandwidth Output - Reporting Period: "+startDate+" to "+stopDate], ["Centre: "+localCentre], ["Product Type"]];
  let subHeaderTemp = "Avg bandwidth (Mbps)";

  // update datasourcesMap:
  datasourcesMap = (await getDatasourcesMap()).data;
  
  datasourcesMap.forEach(datasource => {
    tempBandwidthOutputJson[1].push("from "+datasource.name);
    tempBandwidthOutputJson[2].push(subHeaderTemp);
  });

  // update productTypeFamilyList:
  productTypeFamilyList = (await getProductTypeFamilyList()).data;

  // Body
  let productsDescriptionArr = productTypeFamilyList.sort((a, b) => {
    const groupCompare = a.group.localeCompare(b.group);
    if (groupCompare !== 0) return groupCompare;
    return a.subGroup.localeCompare(b.subGroup);
  });
  let tempDescGroupPrec = "";
  let tempDescSubGroupPrec = "";
  let tempTotalRowArr = ["TOTAL BANDWIDTH BY DHR (Mbps):"];
  let tempFinalTotalRowArr = ["TOTAL BANDWIDTH (Mbps):"];
  let sumBandwidth = new Array(datasourcesMap.length).fill(0);

  productsDescriptionArr.forEach(productObj => {
    const tempDescGroup = productObj.group;
    const tempDescSubGroup = productObj.subGroup;
    
    // Insert Group Name
    let tempGroupProductArr = [productObj.group];
    if (tempDescGroup !== tempDescGroupPrec) {
      datasourcesMap.forEach(datasource => {
        tempGroupProductArr.push(0);
      });
      tempBandwidthOutputJson.push(tempGroupProductArr);
    }

    // Insert SubGroup Name
    if (productObj.group !== "SENTINEL 5P") {
      let tempSubGroupProductArr = [productObj.subGroup];
      if (tempDescSubGroup !== tempDescSubGroupPrec) {
        datasourcesMap.forEach(datasource => {
          tempSubGroupProductArr.push(0);
        });
        tempBandwidthOutputJson.push(tempSubGroupProductArr);
      }
    }

    // Insert Product Type (or description, if present)
    let tempProductFamilyArr = [(productObj.description == "" ? productObj.label : productObj.description)];
    datasourcesMap.forEach((datasource, dsIndex) => {
      let tempBandwidth = 0;
      bandwidthStatsJson.forEach((bandwidthStat, index) => {
        // Skip first two rows of header
        if (index > 1 && bandwidthStat[statsBWSheetCols.indexOf('From')] === datasource.name) {
          if (bandwidthStat[statsSheetsCols.indexOf('Product Type')].match(productObj.label)) {
            tempBandwidth += parseFloat(bandwidthStat[statsBWSheetCols.indexOf('Bandwidth (Mbps)')]);
            sumBandwidth[dsIndex] += parseFloat(bandwidthStat[statsBWSheetCols.indexOf('Bandwidth (Mbps)')]);
          }
        }
      })
      tempProductFamilyArr.push(tempBandwidth);
    });
    tempBandwidthOutputJson.push(tempProductFamilyArr);
    tempDescSubGroupPrec = tempDescSubGroup;
    tempDescGroupPrec = tempDescGroup;
  });

  // Add Total counts:
  for (let i = 0; i < datasourcesMap.length; i++) {
    tempTotalRowArr.push(sumBandwidth[i] != null ? sumBandwidth[i].toFixed(4) : -1);
  }
  tempFinalTotalRowArr.push(sumBandwidth.reduce((a, b) => a + b, 0));
  return tempBandwidthOutputJson.concat([tempTotalRowArr]).concat([tempFinalTotalRowArr]);
}

async function createBandwidthDistributedOutputJson(bandwidthStatsJson, startDate, stopDate) {
  wlogger.info("Generating Bandwidth Distributed output sheet");
  // Header
  let tempBandwidthOutputJson = [["Distributed Bandwidth Output - Reporting Period: "+startDate+" to "+stopDate], ["Centre: "+localCentre], ["Product Type"]];
  let subHeaderTemp = "Avg bandwidth (Mbps)";

  // update datasourcesMap:
  datasourcesMap = (await getDatasourcesMap()).data;
  

  datasourcesMap.forEach(datasource => {
    tempBandwidthOutputJson[1].push("to "+datasource.name);
    tempBandwidthOutputJson[2].push(subHeaderTemp);
  });

  // update productTypeFamilyList:
  productTypeFamilyList = (await getProductTypeFamilyList()).data;

  // Body
  let productsDescriptionArr = productTypeFamilyList.sort((a, b) => {
    const groupCompare = a.group.localeCompare(b.group);
    if (groupCompare !== 0) return groupCompare;
    return a.subGroup.localeCompare(b.subGroup);
  });
  let tempDescGroupPrec = "";
  let tempDescSubGroupPrec = "";
  let tempTotalRowArr = ["TOTAL BANDWIDTH BY DHR (Mbps):"];
  let tempFinalTotalRowArr = ["TOTAL BANDWIDTH (Mbps):"];
  let sumBandwidth = new Array(datasourcesMap.length).fill(0);

  productsDescriptionArr.forEach(productObj => {
    const tempDescGroup = productObj.group;
    const tempDescSubGroup = productObj.subGroup;
    
    // Insert Group Name
    let tempGroupProductArr = [productObj.group];
    if (tempDescGroup !== tempDescGroupPrec) {
      datasourcesMap.forEach(datasource => {
        tempGroupProductArr.push(0);
      });
      tempBandwidthOutputJson.push(tempGroupProductArr);
    }

    // Insert SubGroup Name
    if (productObj.group !== "SENTINEL 5P") {
      let tempSubGroupProductArr = [productObj.subGroup];
      if (tempDescSubGroup !== tempDescSubGroupPrec) {
        datasourcesMap.forEach(datasource => {
          tempSubGroupProductArr.push(0);
        });
        tempBandwidthOutputJson.push(tempSubGroupProductArr);
      }
    }

    // Insert Product Type (or description, if present)
    let tempProductFamilyArr = [(productObj.description == "" ? productObj.label : productObj.description)];
    datasourcesMap.forEach((datasource, dsIndex) => {
      let tempBandwidth = 0;
      bandwidthStatsJson.forEach((bandwidthStat, index) => {
        // Skip first two rows of header
        if (index > 1 && bandwidthStat[statsBWSheetCols.indexOf('To')] === datasource.name) {
          if (bandwidthStat[statsSheetsCols.indexOf('Product Type')].match(productObj.label)) {
            tempBandwidth += parseFloat(bandwidthStat[statsBWSheetCols.indexOf('Bandwidth (Mbps)')]);
            sumBandwidth[dsIndex] += parseFloat(bandwidthStat[statsBWSheetCols.indexOf('Bandwidth (Mbps)')]);
          }
        }
      })
      tempProductFamilyArr.push(tempBandwidth);
    });
    tempBandwidthOutputJson.push(tempProductFamilyArr);
    tempDescSubGroupPrec = tempDescSubGroup;
    tempDescGroupPrec = tempDescGroup;
  });

  // Add Total counts:
  for (let i = 0; i < datasourcesMap.length; i++) {
    tempTotalRowArr.push(sumBandwidth[i] != null ? sumBandwidth[i].toFixed(4) : -1);
  }
  tempFinalTotalRowArr.push(sumBandwidth.reduce((a, b) => a + b, 0));
  
  return tempBandwidthOutputJson.concat([tempTotalRowArr]).concat([tempFinalTotalRowArr]);
}

async function createErrorLogOutputJson(errorsArray) {
  wlogger.info("Generating Error Log Output Sheet");
  let outArr = [];
  outArr.push([
    "Date", "Error Source", "Error Type", "Error Message"
  ]);
  if (errorsArray && errorsArray.length > 0) {
    wlogger.debug("Got Errors Array: " + JSON.stringify(errorsArray, null, 2));
    errorsArray.forEach((err) => {
      if (err.hasOwnProperty("date") && err.hasOwnProperty("errorSource") && err.hasOwnProperty("errorType") && err.hasOwnProperty("errorMessage")) {
        outArr.push([
          err.date, err.errorSource, err.errorType, err.errorMessage
        ]);
      } else {
        outArr.push([
          this.getDateStr(new Date()), "output", "unknown", "There was a problem while reading the reports errors for the requested period. Please check in the generated reports json for any data inconsistency."
        ]);
      }
    });
    errorsArray.unshift({"error": "The requested period data contain some error. Find more info inside the report."});
    wlogger.error("The requested period data contain some error.");
    return outArr;
  } else {
    wlogger.info("No errors found to put into the log sheet.");
  }
  return outArr;
}

// Helper for regex-safe
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Helper to edit colors
function shadeColor(color, percent) {
    var R = parseInt(color.substring(0,2),16);
    var G = parseInt(color.substring(2,4),16);
    var B = parseInt(color.substring(4,6),16);

    R = parseInt(R * (100 + percent) / 100);
    G = parseInt(G * (100 + percent) / 100);
    B = parseInt(B * (100 + percent) / 100);

    R = (R<255)?R:255;  
    G = (G<255)?G:255;  
    B = (B<255)?B:255;  

    R = Math.round(R)
    G = Math.round(G)
    B = Math.round(B)

    var RR = ((R.toString(16).length==1)?"0"+R.toString(16):R.toString(16));
    var GG = ((G.toString(16).length==1)?"0"+G.toString(16):G.toString(16));
    var BB = ((B.toString(16).length==1)?"0"+B.toString(16):B.toString(16));

    return ""+RR+GG+BB;
}

function ensureCell(ws, ref) {
  if (!ws[ref]) ws[ref] = { t: 's', v: '' }; // create empty string cell
  return ws[ref];
}

function checkArrayOfArrays(a){
  if (!Array.isArray(a)) return false;
  return a.every(function(x){ return Array.isArray(x); });
}

function getDateStr(date) {
  if (typeof date === 'string') date = new Date(date);
  if (!date) return '';
  return date.toISOString().slice(0, 10);
}