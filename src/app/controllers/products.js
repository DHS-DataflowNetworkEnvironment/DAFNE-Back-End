//Models imports
const axios = require('axios');
const Centre = require("../models/centre");
const Service = require("../models/service");
const Sequelize = require('sequelize');
const urljoin = require('url-join');
const Utilcrypto = require('../util/Utilcrypto');
const util = require('../util/utility');
const wlogger = require('../util/wlogger');
const conf = require('../util/config');
const stringify = require('json-stable-stringify');

const productsUrl_odata_v1 = "odata/v1/Products/$count?$filter=startswith(Name,':mission') and substringof(':type',Name) and CreationDate ge datetime':dateT00:00:00.000' and CreationDate le datetime':dateT23:59:59.999'"
const productsUrl_odata_v4 = "odata/v1/Products/$count?$filter=startswith(Name,':mission') and contains(Name,':type') and PublicationDate ge datetime':dateT00:00:00.000' and PublicationDate le datetime':dateT23:59:59.999'"
const productsFilterUrl = "odata/v1/Products/$count?$filter=:filter CreationDate ge datetime':dateT00:00:00.000' and CreationDate le datetime':dateT23:59:59.999'"


//Compute products completeness related to provided filters for all centres
// For all authenticated users
/* Request body example:
 * {
 	"mission":"S1A",
	"productType":"GRD",
	"startDate":"2021-11-05",
	"stopDate":"2021-11-06"
 * }
   Response example
   [
	{
		"date": "2021-11-01",
		"values": [
			{ "id": 1, "name": "ASI", "color": "#ff0000", "local": true, "value": 300 },
			{ "id": 2, "name": "Airbus", "color": "#ff0000", "local": false, "value": 300 },
		]
	}
   ]
*/
exports.computeCompleteness = async (req, res, next) => {
	let completeness = [];
		
	try {
		wlogger.debug("request body");
		wlogger.debug(req.body);
		// ger request body fields
		const mission = req.body.mission;
		const productType = req.body.productType;
		const filter = req.body.filter;
		const startDate = new Date(req.body.startDate);
		const stopDate = new Date(req.body.stopDate);
		// get list of dates
		const dateRange = util.getDatesList(startDate, stopDate)
		wlogger.debug("Compute completeness for the following dates:");
		wlogger.debug(dateRange);
	
		const centres = await Centre.findAll({});
		
		for (const centre of centres) {
			
			/* DHuS */
			try {
				// Get the FE ,Single Instance, DAS, PRIP or LTA services of each centre
				const service = await Service.findOne({
					where: {
						centre: centre.id,
						service_type: {
							[Sequelize.Op.in]: [1, 2, 4, 5, 6]  //Exclude BE services from completeness computation
						}
					}
				});
				if(service) {
				// get service completeness for each date in range
					for (const date of dateRange) {
						let timeout;
						try {
							let requestUrl;
							if (service.service_type < 4) {
								requestUrl = productsUrl_odata_v1.replace(':mission', mission).replace(':type', productType);
							} else {
								requestUrl = productsUrl_odata_v4.replace(':mission', mission).replace(':type', productType);
							}
							requestUrl = requestUrl.replace(/:date/g, date);
							wlogger.debug("current requestUrl");
							wlogger.debug(urljoin(service.service_url, requestUrl));
							const source = axios.CancelToken.source();
							let requestTimeout = (conf.getConfig().requestTimeout) ? conf.getConfig().requestTimeout : 30000;
							timeout = setTimeout(() => {
								source.cancel();
								wlogger.error("No response received from Service while computing completeness " + service.service_url); 
								wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
							}, requestTimeout);
							const count = await axios({
								method: 'get',
								url: urljoin(service.service_url, requestUrl),
								auth: {
									username: service.username,
									password: Utilcrypto.decrypt(service.password)
								},
								validateStatus: false,
								cancelToken: source.token
								
							}).catch(err => {
								if (err.response) {
								// client received an error response (5xx, 4xx)
								wlogger.error("Received error response from Service while computing completeness " + service.service_url); 
								wlogger.error(err);
								} else if (err.request) {
								// client never received a response, or request never left
								wlogger.error("No response received from Service while computing completeness " + service.service_url); 
								wlogger.error(err);
								} else {
								// anything else
								wlogger.error("Error from Service while computing completeness " + service.service_url); 
								wlogger.error(err);
								}
							});
							// Clear The Timeout
    						clearTimeout(timeout);
							let value;
							if(count && count.status == 200){
							
								value = { "id": centre.id, "name": centre.name, "color": centre.color, "local": centre.local, "value": count.data };
							} else {
								value = { "id": centre.id, "name": centre.name, "color": centre.color, "local": centre.local, "value": -1 };
							}
							wlogger.debug("New value from request: " + urljoin(service.service_url, requestUrl));
							wlogger.debug(value);
							// check if the array already contains the current date
							let found = completeness.some(el => el.date == date);
							// date not found, add the full object object
							if (!found) {
								wlogger.debug("Found values to add for new date " + date);

								let obj = {};
								obj.date = date;
								obj.values = [];
								obj.values.push(value);
								completeness.push(obj);
							} else {
								wlogger.debug("Date " + date + " already present, add new value");
								// date found, add only value
								let outcome = completeness.find((o, i) => {
									if (o.date === date) {
										completeness[i].values.push(value);
										return true;
									}
								});
							}
							
						} catch (e) {
							wlogger.error("error getting completeness for centre " + centre.id + " in the date " + date);
							wlogger.error(e)
						}
					}
				}
				wlogger.debug("Partial completeness:");
				wlogger.debug(completeness)
			} catch (err){
				wlogger.error("error getting completeness for centre " + centre.id)
				wlogger.error(err)
			}
		}
		wlogger.debug("Total completeness:");
		wlogger.debug(completeness)
		return res.status(200).json(completeness);
	} catch (error) {
		wlogger.error(error);
		return res.status(500).json(error);
	}
};

//Compute products completeness related to provided sync filter for all centres
// For all authenticated users
/* Request body example:
 * {
 	"filter":"substringof('_MSI', Name)",
	"startDate":"2021-11-05",
	"stopDate":"2021-11-06"
 * }
   Response example
   [
	{
		"date": "2021-11-01",
		"values": [
			{ "id": 1, "name": "ASI", "color": "#ff0000", "local": true, "value": 300 },
			{ "id": 2, "name": "Airbus", "color": "#ff0000", "local": false, "value": 300 },
		]
	}
   ]
*/
exports.computeFilterCompleteness = async (req, res, next) => {
	let completeness = [];
		
	try {
		wlogger.debug("request body");
		wlogger.debug(req.body);
		// ger request body fields
		let filter = "";
		if (req.body.filter !== null) {
			filter = req.body.filter.concat(" and");
		}
		const startDate = new Date(req.body.startDate);
		const stopDate = new Date(req.body.stopDate);
		// get list of dates
		const dateRange = util.getDatesList(startDate, stopDate)
		wlogger.debug("Compute completeness for the following dates:");
		wlogger.debug(dateRange);
	
		const centres = await Centre.findAll({});
		
		for (const centre of centres) {
			try {
				// Get the FE or Single Instance services of each centre
				const service = await Service.findOne({
					where: {
						centre: centre.id,
						service_type: {
							[Sequelize.Op.in]: [1, 2]  //Exclude BE services from completeness computation
						}
					}
				});
				if(service) {
				// get service completeness for each date in range
					for (const date of dateRange) {
						let timeout;
						try {
							let requestUrl = productsFilterUrl.replace(':filter', filter);
							requestUrl = requestUrl.replace(/:date/g, date);
							wlogger.debug("current requestUrl");
							wlogger.debug(urljoin(service.service_url, requestUrl));
							const source = axios.CancelToken.source();
							let requestTimeout = (conf.getConfig().requestTimeout) ? conf.getConfig().requestTimeout : 30000;
							timeout = setTimeout(() => {
								source.cancel();
								wlogger.error("No response received from Service while computing completeness " + service.service_url); 
								wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
							}, requestTimeout);
							const count = await axios({
								method: 'get',
								url: urljoin(service.service_url, requestUrl),
								auth: {
									username: service.username,
									password: Utilcrypto.decrypt(service.password)
								},
								validateStatus: false,
								cancelToken: source.token
								
							}).catch(err => {
								if (err.response) {
								// client received an error response (5xx, 4xx)
								wlogger.error("Received error response from Service while computing completeness " + service.service_url); 
								wlogger.error(err);
								} else if (err.request) {
								// client never received a response, or request never left
								wlogger.error("No response received from Service while computing completeness " + service.service_url); 
								wlogger.error(err);
								} else {
								// anything else
								wlogger.error("Error from Service while computing completeness " + service.service_url); 
								wlogger.error(err);
								}
							});
							// Clear The Timeout
    						clearTimeout(timeout);
							let value;
							if(count && count.status == 200){
							
								value = { "id": centre.id, "name": centre.name, "color": centre.color, "local": centre.local, "value": count.data };
							} else {
								value = { "id": centre.id, "name": centre.name, "color": centre.color, "local": centre.local, "value": -1 };
							}
							wlogger.debug("New value from request: " + urljoin(service.service_url, requestUrl));
							wlogger.debug(value);
							// check if the array already contains the current date
							let found = completeness.some(el => el.date == date);
							// date not found, add the full object object
							if (!found) {
								wlogger.debug("Found values to add for new date " + date);

								let obj = {};
								obj.date = date;
								obj.values = [];
								obj.values.push(value);
								completeness.push(obj);
							} else {
								wlogger.debug("Date " + date + " already present, add new value");
								// date found, add only value
								let outcome = completeness.find((o, i) => {
									if (o.date === date) {
										completeness[i].values.push(value);
										return true;
									}
								});
							}
							
						} catch (e) {
							wlogger.error("error getting completeness for centre " + centre.id + " in the date " + date);
							wlogger.error(e)
						}
					}
				}
				wlogger.debug("Partial completeness:");
				wlogger.debug(completeness)
			} catch (err){
				wlogger.error("error getting completeness for centre " + centre.id)
				wlogger.error(err)
			}
		}
		wlogger.debug("Total completeness:");
		wlogger.debug(completeness)
		return res.status(200).json(completeness);
	} catch (error) {
		wlogger.error(error);
		return res.status(500).json(error);
	}
};

