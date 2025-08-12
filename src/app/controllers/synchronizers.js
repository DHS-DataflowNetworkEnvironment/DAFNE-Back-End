//Models imports
const axios = require('axios');
const Sequelize = require('sequelize');
const Centre = require("app/models/centre");
const Service = require("app/models/service");
const Utilcrypto = require('app/util/utilcrypto');
const utility = require('app/util/utility');
const wlogger = require('app/util/wlogger');
const conf = require('app/util/config');

const synchUrl = '/odata/v1/Synchronizers'
const collectionsUrl = '/odata/v2/Collections?$select=Name'
const targetCollectionUrl = '/odata/v1/Synchronizers(:idL)/TargetCollection'
const updateSynchUrl = '/odata/v1/Synchronizers(:idL)'
const getSynchronizersUrl = '/odata/v2/Synchronizers';
const getProductSourcesUrl = '/odata/v2/ProductSources';


//GET-ALL Get all synchronizers of the local Centre
// For all authenticated users
exports.getAll = async (req, res, next) => {
	let synchronizers = [];
	
	let collectionList;
	let timeout;
	try {
		const centre = await Centre.findOne({
			where: {
				local: true
			}
		});
		const services = await Service.findAll({
			where: {
				centre: centre.id,
				service_type: {
					[Sequelize.Op.in]: [1, 3]  //Exclude FE services from synch list
				}
			}
		});

		let requestTimeout = (conf.getConfig().requestTimeout) ? conf.getConfig().requestTimeout : 30000;
		for (const service of services) {
			let synchList = [];
			
			let source = axios.CancelToken.source();
			timeout = setTimeout(() => {
				source.cancel();
				wlogger.error("No response received from Service " + service.service_url); 
				wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
			}, requestTimeout);
			const synch = await axios({
				method: 'get',
				url: (new URL(service.service_url + synchUrl)).href,
				auth: {
					username: service.username,
					password: Utilcrypto.decrypt(service.password)
				},
				validateStatus: false,
				cancelToken: source.token
			  }).catch(err => {
				if (err.response) {
				  // client received an error response (5xx, 4xx)
				  wlogger.error("Received error response from Service " + service.service_url); 
				  wlogger.error(err);
				} else if (err.request) {
				  // client never received a response, or request never left
				  wlogger.error("No response received from Service " + service.service_url); 
				  wlogger.error(err);
				} else {
				  // anything else
				  wlogger.error("Error from Service " + service.service_url); 
				  wlogger.error(err);
				}
			});
			// Clear The Timeout
			clearTimeout(timeout);
			if(synch && synch.status == 200 && synch.data){

				wlogger.debug(synch.data.d.results); 
				for (const element of synch.data.d.results) {
					const source = axios.CancelToken.source();
					timeout = setTimeout(() => {
						source.cancel();
						wlogger.error("No response received from Service while getting targetcollection info " + service.service_url); 
						wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
					}, requestTimeout);
					const tc = await axios({
						method: 'get',
						url: (new URL(service.service_url + targetCollectionUrl.replace(':id',element.Id))).href,
						auth: {
							username: service.username,
							password: Utilcrypto.decrypt(service.password)
						},
						validateStatus: false,
						cancelToken: source.token
					  }).catch(err => {
						if (err.response) {
						  // client received an error response (5xx, 4xx)
						  wlogger.error("Received error response while getting targetcollection info from Service " + service.service_url); 
						  wlogger.error(err);
						} else if (err.request) {
						  // client never received a response, or request never left
						  wlogger.error("No response received while getting targetcollection info from Service " + service.service_url); 
						  wlogger.error(err);
						} else {
						  // anything else
						  wlogger.error("Error while getting targetcollection info from Service " + service.service_url); 
						  wlogger.error(err);
						}
					});
					// Clear The Timeout
					clearTimeout(timeout);
					if(tc && tc.status == 200 && tc.data && tc.data.d){
						wlogger.debug("targetcollection for synch " + element.Id);
						wlogger.debug(tc.data);
						element.TargetCollectionName = tc.data.d.Name;

					}

					synchList.push(element);
				
				} 
				wlogger.debug("Synchronizers list for service " + service.service_url);
				wlogger.debug(synchList);
			}
			source = axios.CancelToken.source();
			timeout = setTimeout(() => {
				source.cancel();
				wlogger.error("No response received from Service while getting collection list" + service.service_url); 
				wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
			}, requestTimeout);
			const collections = await axios({
				method: 'get',
				url: (new URL(service.service_url + collectionsUrl)).href,
				auth: {
					username: service.username,
					password: Utilcrypto.decrypt(service.password)
				},
				validateStatus: false,
				cancelToken: source.token
			  }).catch(err => {
				if (err.response) {
				  // client received an error response (5xx, 4xx)
				  wlogger.error("Received error response while getting collection list from Service " + service.service_url); 
				  wlogger.error(err);
				} else if (err.request) {
				  // client never received a response, or request never left
				  wlogger.error("No response received while getting collection list from  Service " + service.service_url); 
				  wlogger.error(err);
				} else {
				  // anything else
				  wlogger.error("Error  while getting collection list from Service " + service.service_url); 
				  wlogger.error(err);
				}
			});
			// Clear The Timeout
			clearTimeout(timeout);
			if(collections && collections.status == 200 && collections.data){
				
				collectionList= collections.data.value;

				 
				wlogger.debug("Collections list for service " + service.service_url);
				wlogger.debug(collectionList);
			}
			let synchObj = {};
			const sources = await utility.performDHuSServiceRequest(service, getProductSourcesUrl);
			wlogger.debug("Synchronizers - Product Sources HTTP response");
			if (sources && sources.status == 404) {
				synchObj.intelligentSyncSupported = false;
			} else {
				synchObj.intelligentSyncSupported = true;
			}			
			synchObj.serviceUrl = service.service_url;
			synchObj.synchronizers = synchList;
			synchObj.collections = collectionList;
			synchronizers.push(synchObj);
		}
		wlogger.info({ "OK getAll Synchronizers:": synchronizers });
		
		return res.status(200).json(synchronizers);
	} catch (error) {
		wlogger.error(error);
		return res.status(500).json(error);
	}
};

//GET-ALL-FE Get all FE synchronizers of the local Centre
// For all authenticated users
exports.getAllFE = async (req, res, next) => {
	let synchronizers = [];
	
	let collectionList;
	let timeout;
	try {
		const centre = await Centre.findOne({
			where: {
				local: true
			}
		});
		const services = await Service.findAll({
			where: {
				centre: centre.id,
				service_type: {
					[Sequelize.Op.in]: [2]  //Get only FE services from synch list
				}
			}
		});

		let requestTimeout = (conf.getConfig().requestTimeout) ? conf.getConfig().requestTimeout : 30000;
		for (const service of services) {
			let synchList = [];
			
			let source = axios.CancelToken.source();
			timeout = setTimeout(() => {
				source.cancel();
				wlogger.error("No response received from Service " + service.service_url); 
				wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
			}, requestTimeout);
			const synch = await axios({
				method: 'get',
				url: (new URL(service.service_url + synchUrl)).href,
				auth: {
					username: service.username,
					password: Utilcrypto.decrypt(service.password)
				},
				validateStatus: false,
				cancelToken: source.token
			  }).catch(err => {
				if (err.response) {
				  // client received an error response (5xx, 4xx)
				  wlogger.error("Received error response from Service " + service.service_url); 
				  wlogger.error(err);
				} else if (err.request) {
				  // client never received a response, or request never left
				  wlogger.error("No response received from Service " + service.service_url); 
				  wlogger.error(err);
				} else {
				  // anything else
				  wlogger.error("Error from Service " + service.service_url); 
				  wlogger.error(err);
				}
			});
			// Clear The Timeout
			clearTimeout(timeout);
			if(synch && synch.status == 200 && synch.data){

				wlogger.debug(synch.data.d.results); 
				for (const element of synch.data.d.results) {
					const source = axios.CancelToken.source();
					timeout = setTimeout(() => {
						source.cancel();
						wlogger.error("No response received from Service while getting targetcollection info " + service.service_url); 
						wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
					}, requestTimeout);
					const tc = await axios({
						method: 'get',
						url: (new URL(service.service_url + targetCollectionUrl.replace(':id',element.Id))).href,
						auth: {
							username: service.username,
							password: Utilcrypto.decrypt(service.password)
						},
						validateStatus: false,
						cancelToken: source.token
					  }).catch(err => {
						if (err.response) {
						  // client received an error response (5xx, 4xx)
						  wlogger.error("Received error response while getting targetcollection info from Service " + service.service_url); 
						  wlogger.error(err);
						} else if (err.request) {
						  // client never received a response, or request never left
						  wlogger.error("No response received while getting targetcollection info from Service " + service.service_url); 
						  wlogger.error(err);
						} else {
						  // anything else
						  wlogger.error("Error while getting targetcollection info from Service " + service.service_url); 
						  wlogger.error(err);
						}
					});
					// Clear The Timeout
					clearTimeout(timeout);
					if(tc && tc.status == 200 && tc.data && tc.data.d){
						wlogger.debug("targetcollection for synch " + element.Id);
						wlogger.debug(tc.data);
						element.TargetCollectionName = tc.data.d.Name;

					}

					synchList.push(element);
				
				} 
				wlogger.debug("FE Synchronizers list for service " + service.service_url);
				wlogger.debug(synchList);
			}
			source = axios.CancelToken.source();
			timeout = setTimeout(() => {
				source.cancel();
				wlogger.error("No response received from Service while getting collection list" + service.service_url); 
				wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
			}, requestTimeout);
			const collections = await axios({
				method: 'get',
				url: (new URL(service.service_url + collectionsUrl)).href,
				auth: {
					username: service.username,
					password: Utilcrypto.decrypt(service.password)
				},
				validateStatus: false,
				cancelToken: source.token
			  }).catch(err => {
				if (err.response) {
				  // client received an error response (5xx, 4xx)
				  wlogger.error("Received error response while getting collection list from Service " + service.service_url); 
				  wlogger.error(err);
				} else if (err.request) {
				  // client never received a response, or request never left
				  wlogger.error("No response received while getting collection list from  Service " + service.service_url); 
				  wlogger.error(err);
				} else {
				  // anything else
				  wlogger.error("Error while getting collection list from Service " + service.service_url); 
				  wlogger.error(err);
				}
			});
			// Clear The Timeout
			clearTimeout(timeout);
			if(collections && collections.status == 200 && collections.data){
				
				collectionList= collections.data.value;

				 
				wlogger.debug("Collections list for service " + service.service_url);
				wlogger.debug(collectionList);
			}
			let synchObj = {};
			const sources = await utility.performDHuSServiceRequest(service, getProductSourcesUrl);
            wlogger.debug("Synchronizers - Product Sources HTTP response");
            if (sources && sources.status == 404) {
				synchObj.intelligentSyncSupported = false;
			} else {
				synchObj.intelligentSyncSupported = true;
			}			
			synchObj.serviceUrl = service.service_url;
			synchObj.synchronizers = synchList;
			synchObj.collections = collectionList;
			synchronizers.push(synchObj);
		}
		wlogger.info({ "OK getAllFE Synchronizers:": synchronizers });
		
		return res.status(200).json(synchronizers);
	} catch (error) {
		wlogger.error(error);
		return res.status(500).json(error);
	}
};

//GET-ALL-BE Get all BE synchronizers of the local Centre
// For all authenticated users
exports.getAllBE = async (req, res, next) => {
	let synchronizers = [];
	
	let collectionList;
	let timeout;
	try {
		const centre = await Centre.findOne({
			where: {
				local: true
			}
		});
		const services = await Service.findAll({
			where: {
				centre: centre.id,
				service_type: {
					[Sequelize.Op.in]: [3]  //Get only BE services from synch list
				}
			}
		});

		let requestTimeout = (conf.getConfig().requestTimeout) ? conf.getConfig().requestTimeout : 30000;
		for (const service of services) {
			let synchList = [];
			
			let source = axios.CancelToken.source();
			timeout = setTimeout(() => {
				source.cancel();
				wlogger.error("No response received from Service " + service.service_url); 
				wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
			}, requestTimeout);
			const synch = await axios({
				method: 'get',
				url: (new URL(service.service_url + synchUrl)).href,
				auth: {
					username: service.username,
					password: Utilcrypto.decrypt(service.password)
				},
				validateStatus: false,
				cancelToken: source.token
			  }).catch(err => {
				if (err.response) {
				  // client received an error response (5xx, 4xx)
				  wlogger.error("Received error response from Service " + service.service_url); 
				  wlogger.error(err);
				} else if (err.request) {
				  // client never received a response, or request never left
				  wlogger.error("No response received from Service " + service.service_url); 
				  wlogger.error(err);
				} else {
				  // anything else
				  wlogger.error("Error from Service " + service.service_url); 
				  wlogger.error(err);
				}
			});
			// Clear The Timeout
			clearTimeout(timeout);
			if(synch && synch.status == 200 && synch.data){

				wlogger.debug(synch.data.d.results); 
				for (const element of synch.data.d.results) {
					const source = axios.CancelToken.source();
					timeout = setTimeout(() => {
						source.cancel();
						wlogger.error("No response received from Service while getting targetcollection info " + service.service_url); 
						wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
					}, requestTimeout);
					const tc = await axios({
						method: 'get',
						url: (new URL(service.service_url + targetCollectionUrl.replace(':id',element.Id))).href,
						auth: {
							username: service.username,
							password: Utilcrypto.decrypt(service.password)
						},
						validateStatus: false,
						cancelToken: source.token
					  }).catch(err => {
						if (err.response) {
						  // client received an error response (5xx, 4xx)
						  wlogger.error("Received error response while getting targetcollection info from Service " + service.service_url); 
						  wlogger.error(err);
						} else if (err.request) {
						  // client never received a response, or request never left
						  wlogger.error("No response received while getting targetcollection info from Service " + service.service_url); 
						  wlogger.error(err);
						} else {
						  // anything else
						  wlogger.error("Error while getting targetcollection info from Service " + service.service_url); 
						  wlogger.error(err);
						}
					});
					// Clear The Timeout
					clearTimeout(timeout);
					if(tc && tc.status == 200 && tc.data && tc.data.d){
						wlogger.debug("targetcollection for synch " + element.Id);
						wlogger.debug(tc.data);
						element.TargetCollectionName = tc.data.d.Name;

					}

					synchList.push(element);
				
				} 
				wlogger.debug("BE Synchronizers list for service " + service.service_url);
				wlogger.debug(synchList);
			}
			source = axios.CancelToken.source();
			timeout = setTimeout(() => {
				source.cancel();
				wlogger.error("No response received from Service while getting collection list" + service.service_url); 
				wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
			}, requestTimeout);
			const collections = await axios({
				method: 'get',
				url: (new URL(service.service_url + collectionsUrl)).href,
				auth: {
					username: service.username,
					password: Utilcrypto.decrypt(service.password)
				},
				validateStatus: false,
				cancelToken: source.token
			  }).catch(err => {
				if (err.response) {
				  // client received an error response (5xx, 4xx)
				  wlogger.error("Received error response while getting collection list from Service " + service.service_url); 
				  wlogger.error(err);
				} else if (err.request) {
				  // client never received a response, or request never left
				  wlogger.error("No response received while getting collection list from  Service " + service.service_url); 
				  wlogger.error(err);
				} else {
				  // anything else
				  wlogger.error("Error  while getting collection list from Service " + service.service_url); 
				  wlogger.error(err);
				}
			});
			// Clear The Timeout
			clearTimeout(timeout);
			if(collections && collections.status == 200 && collections.data){
				
				collectionList= collections.data.value;

				 
				wlogger.debug("Collections list for service " + service.service_url);
				wlogger.debug(collectionList);
			}
			let synchObj = {};
			const sources = await utility.performDHuSServiceRequest(service, getProductSourcesUrl);
            wlogger.debug("Synchronizers - Product Sources HTTP response");
            if (sources && sources.status == 404) {
				synchObj.intelligentSyncSupported = false;
			} else {
				synchObj.intelligentSyncSupported = true;
			}			
			synchObj.serviceUrl = service.service_url;
			synchObj.synchronizers = synchList;
			synchObj.collections = collectionList;
			synchronizers.push(synchObj);
		}
		wlogger.info({ "OK getAllBE Synchronizers:": synchronizers });
		
		return res.status(200).json(synchronizers);
	} catch (error) {
		wlogger.error(error);
		return res.status(500).json(error);
	}
};

//GET-ALL-SI Get all SI synchronizers of the local Centre
// For all authenticated users
exports.getAllSI = async (req, res, next) => {
	let synchronizers = [];
	
	let collectionList;
	let timeout;
	try {
		const centre = await Centre.findOne({
			where: {
				local: true
			}
		});
		const services = await Service.findAll({
			where: {
				centre: centre.id,
				service_type: {
					[Sequelize.Op.in]: [1]  //Get only SI services from synch list
				}
			}
		});

		let requestTimeout = (conf.getConfig().requestTimeout) ? conf.getConfig().requestTimeout : 30000;
		for (const service of services) {
			let synchList = [];
			
			let source = axios.CancelToken.source();
			timeout = setTimeout(() => {
				source.cancel();
				wlogger.error("No response received from Service " + service.service_url); 
				wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
			}, requestTimeout);
			const synch = await axios({
				method: 'get',
				url: (new URL(service.service_url + synchUrl)).href,
				auth: {
					username: service.username,
					password: Utilcrypto.decrypt(service.password)
				},
				validateStatus: false,
				cancelToken: source.token
			  }).catch(err => {
				if (err.response) {
				  // client received an error response (5xx, 4xx)
				  wlogger.error("Received error response from Service " + service.service_url); 
				  wlogger.error(err);
				} else if (err.request) {
				  // client never received a response, or request never left
				  wlogger.error("No response received from Service " + service.service_url); 
				  wlogger.error(err);
				} else {
				  // anything else
				  wlogger.error("Error from Service " + service.service_url); 
				  wlogger.error(err);
				}
			});
			// Clear The Timeout
			clearTimeout(timeout);
			if(synch && synch.status == 200 && synch.data){

				wlogger.debug(synch.data.d.results); 
				for (const element of synch.data.d.results) {
					const source = axios.CancelToken.source();
					timeout = setTimeout(() => {
						source.cancel();
						wlogger.error("No response received from Service while getting targetcollection info " + service.service_url); 
						wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
					}, requestTimeout);
					const tc = await axios({
						method: 'get',
						url: (new URL(service.service_url + targetCollectionUrl.replace(':id',element.Id))).href,
						auth: {
							username: service.username,
							password: Utilcrypto.decrypt(service.password)
						},
						validateStatus: false,
						cancelToken: source.token
					  }).catch(err => {
						if (err.response) {
						  // client received an error response (5xx, 4xx)
						  wlogger.error("Received error response while getting targetcollection info from Service " + service.service_url); 
						  wlogger.error(err);
						} else if (err.request) {
						  // client never received a response, or request never left
						  wlogger.error("No response received while getting targetcollection info from Service " + service.service_url); 
						  wlogger.error(err);
						} else {
						  // anything else
						  wlogger.error("Error while getting targetcollection info from Service " + service.service_url); 
						  wlogger.error(err);
						}
					});
					// Clear The Timeout
					clearTimeout(timeout);
					if(tc && tc.status == 200 && tc.data && tc.data.d){
						wlogger.debug("targetcollection for synch " + element.Id);
						wlogger.debug(tc.data);
						element.TargetCollectionName = tc.data.d.Name;

					}

					synchList.push(element);
				
				} 
				wlogger.debug("SI Synchronizers list for service " + service.service_url);
				wlogger.debug(synchList);
			}
			source = axios.CancelToken.source();
			timeout = setTimeout(() => {
				source.cancel();
				wlogger.error("No response received from Service while getting collection list" + service.service_url); 
				wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
			}, requestTimeout);
			const collections = await axios({
				method: 'get',
				url: (new URL(service.service_url + collectionsUrl)).href,
				auth: {
					username: service.username,
					password: Utilcrypto.decrypt(service.password)
				},
				validateStatus: false,
				cancelToken: source.token
			  }).catch(err => {
				if (err.response) {
				  // client received an error response (5xx, 4xx)
				  wlogger.error("Received error response while getting collection list from Service " + service.service_url); 
				  wlogger.error(err);
				} else if (err.request) {
				  // client never received a response, or request never left
				  wlogger.error("No response received while getting collection list from  Service " + service.service_url); 
				  wlogger.error(err);
				} else {
				  // anything else
				  wlogger.error("Error  while getting collection list from Service " + service.service_url); 
				  wlogger.error(err);
				}
			});
			// Clear The Timeout
			clearTimeout(timeout);
			if(collections && collections.status == 200 && collections.data){
				
				collectionList= collections.data.value;

				 
				wlogger.debug("Collections list for service " + service.service_url);
				wlogger.debug(collectionList);
			}
			let synchObj = {};
			const sources = await utility.performDHuSServiceRequest(service, getProductSourcesUrl);
            wlogger.debug("Synchronizers - Product Sources HTTP response");
            if (sources && sources.status == 404) {
				synchObj.intelligentSyncSupported = false;
			} else {
				synchObj.intelligentSyncSupported = true;
			}			
			synchObj.serviceUrl = service.service_url;
			synchObj.synchronizers = synchList;
			synchObj.collections = collectionList;
			synchronizers.push(synchObj);
		}
		wlogger.info({ "OK getAllSI Synchronizers:": synchronizers });
		
		return res.status(200).json(synchronizers);
	} catch (error) {
		wlogger.error(error);
		return res.status(500).json(error);
	}
};

/** [POST] /synchronizers
 * 	Create ONE  - For admin only
 *
 * 	@param {synch} req.body the Synchronizer to create and proper service_url
 *  Request body example:
 *  {       
  		"serviceUrl": "http://localhost:8084/",
		"synch": {
			"Label": "APIHUB NEW",
			"ServiceUrl": "https://apihub.copernicus.eu/apihub/odata/v1",
			"ServiceLogin": "user",
			"ServicePassword": "password",
			"RemoteIncoming": null,
			"Schedule": "0 0/2 * * * ?",
			"PageSize": 2,
			"CopyProduct": true,
			"FilterParam": "substringof('SL_2_FRP',Name)",
			"GeoFilter": null,
			"SourceCollection": null,
			"LastCreationDate": "2021-10-10T00:00:00.000",
			"Request": "stop",
			"SyncOfflineProducts": true
			"TargetCollectionName": "test"
		}
	}
	Mandatory fields are:
	Label, ServiceUrl, ServiceLogin, ServicePassword, Schedule (in the proper format), PageSize, LastCreationDate, Request (allowed values start|stop)
 *
 * 	@returns {} the 201 status code if it was created correctly, error status and message otherwise
 */
 exports.createOne = async (req, res) => {
	let timeout; 
	try {
		wlogger.debug("createOne: [POST] /synchronizers");
		let serviceUrl = req.body.serviceUrl;
		if (serviceUrl.lastIndexOf('/') == serviceUrl.length -1) {
			serviceUrl = serviceUrl.slice(0, -1);
		}
		// Find service without '/' in the end 
		let service = await Service.findOne({
			where: {
				service_url: serviceUrl
			}
		});
		// Try finding service with '/' in the end if not found at first attempt
		if(!service) {
			service = await Service.findOne({
				where: {
					service_url: serviceUrl + '/'
				}
			});
		}
		if(!service) {
			return res.status(404).json("Service not found!");
		}
		const body = this.generateBodyFromModel(req.body.synch);
		const source = axios.CancelToken.source();
		let requestTimeout = (conf.getConfig().requestTimeout) ? conf.getConfig().requestTimeout : 30000;
		timeout = setTimeout(() => {
			source.cancel();
			wlogger.error("No response received from Service while creating synchronizer " + service.service_url); 
			wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
		}, requestTimeout);
		const synchronizer = await axios({
			method: 'post',
			url: (new URL(service.service_url + synchUrl)).href,
			auth: {
				username: service.username,
				password: Utilcrypto.decrypt(service.password)
			},
			headers: {
				'Content-Type': 'application/atom+xml', 
				'Accept': 'application/json'
			},
			data: body,
			validateStatus: false,
			cancelToken: source.token
		  }).catch(err => {
			if (err.response) {
			  // client received an error response (5xx, 4xx)
			  wlogger.error("Received error response while creating synchronizer from Service " + service.service_url); 
			  wlogger.error(err);
			} else if (err.request) {
			  // client never received a response, or request never left
			  wlogger.error("No response received while creating synchronizer from  Service " + service.service_url); 
			  wlogger.error(err);
			} else {
			  // anything else
			  wlogger.error("Error  while creating synchronizer from Service " + service.service_url); 
			  wlogger.error(err);
			}
		});
		// Clear The Timeout
		clearTimeout(timeout);
		wlogger.debug("created synchronizer with status " + synchronizer.status);
		return res.status(synchronizer.status).json(synchronizer.data);
		
	} catch (error) {
		wlogger.log({ level: 'info', message: { "ERROR in createOne: ": error } });
		wlogger.error(error);
		return res.status(500).json(error);
	}
};

/** [PUT] /synchronizers/1
 * 	UPDATE ONE  - For admin only
 *
 * 	@param {synch} req.body the Synchronizer to update
 *  @param {string} id query param id of the Synchronizer
 * 
    {       
  		"serviceUrl": "http://localhost:8084/",
		"synch": {
			"Label": "APIHUB NEW",
			"ServiceUrl": "https://apihub.copernicus.eu/apihub/odata/v1",
			"ServiceLogin": "user",
			"ServicePassword": "password",
			"RemoteIncoming": null,
			"Schedule": "0 0/2 * * * ?",
			"PageSize": 2,
			"CopyProduct": true,
			"FilterParam": "substringof('SL_2_FRP',Name)",
			"GeoFilter": null,
			"SourceCollection": null,
			"LastCreationDate": "2021-10-10T00:00:00.000",
			"Request": "stop",
			"SyncOfflineProducts": true
			"TargetCollectionName": "test"
		}
	}
	The synch object can contain only the fields to modify
	Parameter to start a synchronizer: "Request": "start"
	Parameter to stop a synchronizer: "Request": "stop"
 *
 *
 * 	@returns {} the 204 status code with no message if it was updated correctly, error status and message otherwise
 */
exports.updateOne = async (req, res) => {
	let timeout;
	try {
		wlogger.debug("updateOne: [PUT] /synchronizers/:id");
		let serviceUrl = req.body.serviceUrl;
		if (serviceUrl.lastIndexOf('/') == serviceUrl.length -1) {
			serviceUrl = serviceUrl.slice(0, -1);
		}
		
		// Find service without '/' in the end 
		let service = await Service.findOne({
			where: {
				service_url: serviceUrl
			}
		});
		// Try finding service with '/' in the end if not found at first attempt
		if(!service) {
			service = await Service.findOne({
				where: {
					service_url: serviceUrl + '/'
				}
			});
		}
		if(!service) {
			return res.status(404).json("Service not found!");
		}
		const body = this.generateBodyFromModel(req.body.synch);
		const source = axios.CancelToken.source();
		let requestTimeout = (conf.getConfig().requestTimeout) ? conf.getConfig().requestTimeout : 30000;
		timeout = setTimeout(() => {
			source.cancel();
			wlogger.error("No response received from Service while updating synchronizer " + service.service_url); 
			wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
		}, requestTimeout);
		const synchronizer = await axios({
			method: 'put',
			url: (new URL(service.service_url + updateSynchUrl.replace(':id',req.params.id))).href,
			auth: {
				username: service.username,
				password: Utilcrypto.decrypt(service.password)
			},
			headers: {
				'Content-Type': 'application/atom+xml', 
				'Accept': 'application/json'
			},
			data: body,
			validateStatus: false,
			cancelToken: source.token
		}).catch(err => {
			if (err.response) {
			// client received an error response (5xx, 4xx)
			wlogger.error("Received error response while updating synchronizer from Service " + service.service_url); 
			wlogger.error(err);
			} else if (err.request) {
			// client never received a response, or request never left
			wlogger.error("No response received while updating synchronizer from  Service " + service.service_url); 
			wlogger.error(err);
			} else {
			// anything else
			wlogger.error("Error  while updating synchronizer from Service " + service.service_url); 
			wlogger.error(err);
			}
		});
		// Clear The Timeout
		clearTimeout(timeout);
		wlogger.debug("updated synchronizer with status " + synchronizer.status);
		return res.status(synchronizer.status).json(synchronizer.data);
		
		
	} catch (error) {
		wlogger.log({ level: 'info', message: { "ERROR in updateOne: ": error } });
		wlogger.error(error);
		return res.status(500).json(error);
	}
};

/** [DELETE] /synchronizers/1
 * 	DELETE ONE  - For admin only
 *
 * 	@param {synch} req.body the Synchronizer to update
 *  @param {string} id query param id of the Synchronizer
	Request body example
    {       
  		"serviceUrl": "http://localhost:8084/"
	}
 *
 * 	@returns {} the 200 status code with no message if it was deleted correctly, error status and message otherwise
 */
 exports.deleteOne = async (req, res) => {
	let timeout;
	try {
		wlogger.debug("deleteOne: [DELETE] /synchronizers/:id");
		let serviceUrl = req.body.serviceUrl;
		if (serviceUrl.lastIndexOf('/') == serviceUrl.length -1) {
			serviceUrl = serviceUrl.slice(0, -1);
		}
		
		// Find service without '/' in the end 
		let service = await Service.findOne({
			where: {
				service_url: serviceUrl
			}
		});
		// Try finding service with '/' in the end if not found at first attempt
		if(!service) {
			service = await Service.findOne({
				where: {
					service_url: serviceUrl + '/'
				}
			});
		}
		if (!service) {
			return res.status(404).json("Service not found!");
		}
		const source = axios.CancelToken.source();
		let requestTimeout = (conf.getConfig().requestTimeout) ? conf.getConfig().requestTimeout : 30000;
		timeout = setTimeout(() => {
			source.cancel();
			wlogger.error("No response received from Service while deleting synchronize " + service.service_url); 
			wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
		}, requestTimeout);
		const synchronizer = await axios({
			method: 'DELETE',
			url: (new URL(service.service_url + updateSynchUrl.replace(':id',req.params.id))).href,
			auth: {
				username: service.username,
				password: Utilcrypto.decrypt(service.password)
			},
			headers: {
				'Content-Type': 'application/atom+xml', 
				'Accept': 'application/json'
			},
			validateStatus: false,
			cancelToken: source.token
		  }).catch(err => {
			if (err.response) {
			  // client received an error response (5xx, 4xx)
			  wlogger.error("Received error response while deleting synchronizer from Service " + service.service_url); 
			  wlogger.error(err);
			} else if (err.request) {
			  // client never received a response, or request never left
			  wlogger.error("No response received while deleting synchronizer from  Service " + service.service_url); 
			  wlogger.error(err);
			} else {
			  // anything else
			  wlogger.error("Error  while deleting synchronizer from Service " + service.service_url); 
			  wlogger.error(err);
			}
		});
		// Clear The Timeout
		clearTimeout(timeout);
		wlogger.debug("deleted synchronizer with status " + synchronizer.status);
		return res.status(synchronizer.status).json(synchronizer.data);
		
	} catch (error) {
		wlogger.log({ level: 'info', message: { "ERROR in deleteOne: ": error } });
		wlogger.error(error);
		return res.status(500).json(error);
	}
};

exports.generateBodyFromModel = (model) => {
	return '<entry xmlns:d="http://schemas.microsoft.com/ado/2007/08/dataservices" xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata" xmlns="http://www.w3.org/2005/Atom"> \
        <title type="text">Synchronizer</title> \
        <category term="DHuS.Synchronizer" scheme="http://schemas.microsoft.com/ado/2007/08/dataservices/scheme" /> ' +
                            ((model.TargetCollectionName && (model.TargetCollectionName != '')) ? '<link rel="http://schemas.microsoft.com/ado/2007/08/dataservices/related/TargetCollection" type="application/atom+xml;type=entry" title="TargetCollection" href="Collections(\'' + model.TargetCollectionName + '\')" />' : '') +
                            '<content type="application/xml"> \
            <m:properties> ' +
                ((model.Label && (model.Label != '')) ? ('<d:Label>' + model.Label + '</d:Label> ') : '') + 
				((model.ServiceUrl && (model.ServiceUrl != '')) ? ('<d:ServiceUrl>' + model.ServiceUrl + '</d:ServiceUrl> ') : '') +
                ((model.ServiceLogin && (model.ServiceLogin != '')) ? ('<d:ServiceLogin>' + model.ServiceLogin + '</d:ServiceLogin> ') : '') +
				((model.ServicePassword && (model.ServicePassword != '')) ? ('<d:ServicePassword>' + model.ServicePassword + '</d:ServicePassword> ') : '') +
				((model.Schedule && (model.Schedule != '')) ? ('<d:Schedule>' + model.Schedule + '</d:Schedule> ') : '') +
				((model.RemoteIncoming && (model.RemoteIncoming != '')) ? ('<d:RemoteIncoming>' + model.RemoteIncoming + '</d:RemoteIncoming> ') : '') +                           
				'<d:Request>' + model.Request + '</d:Request> ' +
				((model.CopyProduct && (model.CopyProduct != '')) ? ('<d:CopyProduct>' + model.CopyProduct + '</d:CopyProduct> ') : '') +
				((model.FilterParam && model.FilterParam != '') ? ('<d:FilterParam>' + model.FilterParam + '</d:FilterParam> ') : '<d:FilterParam m:null="true" />') +
				((model.GeoFilter && (model.GeoFilter != '')) ? ('<d:GeoFilter>' + model.GeoFilter + '</d:GeoFilter> ') : '<d:GeoFilter m:null="true" />') +
				((model.SourceCollection && (model.SourceCollection != '')) ? ('<d:SourceCollection>' + model.SourceCollection + '</d:SourceCollection> ') : '<d:SourceCollection m:null="true" />') +
				((model.LastCreationDate && (model.LastCreationDate != '')) ? ('<d:LastCreationDate>' + model.LastCreationDate + '</d:LastCreationDate> ') : '') +
				((model.PageSize && (model.PageSize != '')) ? ('<d:PageSize>' + model.PageSize + '</d:PageSize> ') : '') +
				((model.SyncOfflineProducts && (model.SyncOfflineProducts != '')) ? ('<d:SyncOfflineProducts>' + model.SyncOfflineProducts + '</d:SyncOfflineProducts>') : '') +
				'</m:properties> \
        </content> \
      </entry>';

};

//GET-ALL Get all synchronizers v2 of the local Centre
// For all authenticated users
exports.getAllV2 = async (req, res, next) => {
	let synchronizers = [];
		
	try {
		const centre = await Centre.findOne({
			where: {
				local: true
			}
		});
		const services = await Service.findAll({
			where: {
				centre: centre.id,
				service_type: {
					[Sequelize.Op.in]: [1, 3]  //Exclude FE services from synch list
				}
			}
		});
		
		for (const service of services) {
			const sources = await utility.performDHuSServiceRequest(service, getProductSourcesUrl);
      wlogger.debug("Synchronizers - Product Sources HTTP response");
      if (sources && sources.status == 404) {
				const synchList = await utility.performDHuSServiceRequest(service, synchUrl);
				if(synchList && synchList.status == 200 && synchList.data ) {
					let synchObj = {};
					synchObj.intelligentSyncSupported = false;
					synchObj.serviceUrl = service.service_url;
					synchObj.synchronizers = synchList.data.d.results;
					synchronizers.push(synchObj); 				
				} 
			} else {
				const synchList = await utility.performDHuSServiceRequest(service, getSynchronizersUrl);
				if(synchList && synchList.status == 200 && synchList.data ) {
					let synchObj = {};
					synchObj.intelligentSyncSupported = true;
					synchObj.serviceUrl = service.service_url;
					synchObj.synchronizers = synchList.data.value;
					synchronizers.push(synchObj); 				
				} 
			}						
		}
		wlogger.info({ "OK getAll Synchronizers V2:": synchronizers });
		
		return res.status(200).json(synchronizers);
	} catch (error) {
		wlogger.error(error);
		return res.status(500).json(error);
	}
};

//GET-ALL Get all FE synchronizers v2 of the local Centre
// For all authenticated users
exports.getAllV2FE = async (req, res, next) => {
	let synchronizers = [];
		
	try {
		const centre = await Centre.findOne({
			where: {
				local: true
			}
		});
		const services = await Service.findAll({
			where: {
				centre: centre.id,
				service_type: {
					[Sequelize.Op.in]: [2]   //Take only FE services from synch list
				}
			}
		});
		
		for (const service of services) {
			const sources = await utility.performDHuSServiceRequest(service, getProductSourcesUrl);
      wlogger.debug("Synchronizers - Product Sources HTTP response");
      if (sources && sources.status == 404) {
				const synchList = await utility.performDHuSServiceRequest(service, synchUrl);
				if(synchList && synchList.status == 200 && synchList.data ) {
					let synchObj = {};
					synchObj.intelligentSyncSupported = false;
					synchObj.serviceUrl = service.service_url;
					synchObj.synchronizers = synchList.data.d.results;
					synchronizers.push(synchObj); 				
				} 
			} else {
				const synchList = await utility.performDHuSServiceRequest(service, getSynchronizersUrl);
				if(synchList && synchList.status == 200 && synchList.data ) {
					let synchObj = {};
					synchObj.intelligentSyncSupported = true;
					synchObj.serviceUrl = service.service_url;
					synchObj.synchronizers = synchList.data.value;
					synchronizers.push(synchObj); 				
				} 
			}						
		}
		wlogger.info({ "OK getAll FE Synchronizers V2:": synchronizers });
		
		return res.status(200).json(synchronizers);
	} catch (error) {
		wlogger.error(error);
		return res.status(500).json(error);
	}
};

//GET-ALL Get all BE synchronizers v2 of the local Centre
// For all authenticated users
exports.getAllV2BE = async (req, res, next) => {
	let synchronizers = [];
		
	try {
		const centre = await Centre.findOne({
			where: {
				local: true
			}
		});
		const services = await Service.findAll({
			where: {
				centre: centre.id,
				service_type: {
					[Sequelize.Op.in]: [3]   //Take only BE services from synch list
				}
			}
		});
		
		for (const service of services) {
			const sources = await utility.performDHuSServiceRequest(service, getProductSourcesUrl);
      wlogger.debug("Synchronizers - Product Sources HTTP response");
      if (sources && sources.status == 404) {
				const synchList = await utility.performDHuSServiceRequest(service, synchUrl);
				if(synchList && synchList.status == 200 && synchList.data ) {
					let synchObj = {};
					synchObj.intelligentSyncSupported = false;
					synchObj.serviceUrl = service.service_url;
					synchObj.synchronizers = synchList.data.d.results;
					synchronizers.push(synchObj); 				
				} 
			} else {
				const synchList = await utility.performDHuSServiceRequest(service, getSynchronizersUrl);
				if(synchList && synchList.status == 200 && synchList.data ) {
					let synchObj = {};
					synchObj.intelligentSyncSupported = true;
					synchObj.serviceUrl = service.service_url;
					synchObj.synchronizers = synchList.data.value;
					synchronizers.push(synchObj); 				
				} 
			}						
		}
		wlogger.info({ "OK getAll FE Synchronizers V2:": synchronizers });
		
		return res.status(200).json(synchronizers);
	} catch (error) {
		wlogger.error(error);
		return res.status(500).json(error);
	}
};

//GET-ALL Get all SI synchronizers v2 of the local Centre
// For all authenticated users
exports.getAllV2SI = async (req, res, next) => {
	let synchronizers = [];
		
	try {
		const centre = await Centre.findOne({
			where: {
				local: true
			}
		});
		const services = await Service.findAll({
			where: {
				centre: centre.id,
				service_type: {
					[Sequelize.Op.in]: [1]   //Take only SI services from synch list
				}
			}
		});
		
		for (const service of services) {
			const sources = await utility.performDHuSServiceRequest(service, getProductSourcesUrl);
      wlogger.debug("Synchronizers - Product Sources HTTP response");
      if (sources && sources.status == 404) {
				const synchList = await utility.performDHuSServiceRequest(service, synchUrl);
				if(synchList && synchList.status == 200 && synchList.data ) {
					let synchObj = {};
					synchObj.intelligentSyncSupported = false;
					synchObj.serviceUrl = service.service_url;
					synchObj.synchronizers = synchList.data.d.results;
					synchronizers.push(synchObj); 				
				} 
			} else {
				const synchList = await utility.performDHuSServiceRequest(service, getSynchronizersUrl);
				if(synchList && synchList.status == 200 && synchList.data ) {
					let synchObj = {};
					synchObj.intelligentSyncSupported = true;
					synchObj.serviceUrl = service.service_url;
					synchObj.synchronizers = synchList.data.value;
					synchronizers.push(synchObj); 				
				} 
			}						
		}
		wlogger.info({ "OK getAll FE Synchronizers V2:": synchronizers });
		
		return res.status(200).json(synchronizers);
	} catch (error) {
		wlogger.error(error);
		return res.status(500).json(error);
	}
};