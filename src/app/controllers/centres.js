//Models imports
const axios = require('axios');
const Centre = require("../models/centre");
const Service = require("../models/service");
const Sequelize = require('sequelize');
const moment = require('moment');
const sequelize = require('../util/database');
const urljoin = require('url-join');
const Utilcrypto = require('../util/Utilcrypto');
const utility = require('../util/utility');
const wlogger = require('../util/wlogger');
const conf = require('../util/config');

const evictionUrl = 'odata/v2/Evictions';
const synchUrl = 'odata/v1/Synchronizers';
const selectSynchUrl = 'odata/v1/Synchronizers?$select=ServiceUrl,Status';
const productSourcesUrl = 'odata/v2/ProductSources';
const intelliSynchUrl = 'odata/v2/Synchronizers?$expand=ReferencedSources';

/*******************************************************
 * CRUD CONTROLLERS																		 *
 *******************************************************/

/** [POST] /centres
 *  CREATE ONE
 *
 * Mandatory fields for Database insert (allowNull: false):
 * @param {string} req.body.name centre's name
 * @param {Double} req.body.latitude centre's latitude (needed for visualization on map)
 * @param {Double} req.body.longitude centre's longitude (needed for visualization on map)
 * @param {string} req.body.service_url centre's service URL
 * Nullable fields
 * @param {string} req.body.description centre's description
 * @param {string} req.body.icon centre's icon (useful for visualization on map)
 * @param {string} req.body.color centre's color (useful for visualization on map)
 * @returns {Centre} the centre created, status 201 
 */
exports.createOne = async (req, res, next) => {
	try {
		wlogger.debug("createOne: [POST] /centres/");
		const centre = await Centre.create({
			name: req.body.name,
			description: req.body.description, 
			latitude: req.body.latitude,
			longitude: req.body.longitude,
			local: req.body.local,
			icon: req.body.icon,
			color: req.body.color
		});
		wlogger.debug({ "createOne Centre: ": centre });
		return res.status(201).json(centre);
	} catch (error) {
		wlogger.error({ "ERROR createOne Centre:": error });
		return res.status(500).json(error);
	}
};


//GET-ALL 
// TODO: verify if it is needed, if yes for admin only
exports.getAll = async (req, res, next) => {
	try {
		let centres;
		centres = await Centre.findAll({
				order: [['name', 'ASC']],
			});
		wlogger.info({ "OK getAll Centres:": centres });
		return res.status(200).json(centres);
	} catch (error) {
		wlogger.error(error);
		return res.status(500).json(error);
	}
};


/** [GET] /centres/1
 * 	GET ONE
 *
 * 	@param {string} req.params.id id of the centre to get
 *
 * 	@returns {Centre} the centre with the id requested
 */
exports.getOne = async (req, res) => {
	wlogger.debug("getOne: [GET] /centres/:id");
	try {
		const centre = await Centre.findByPk(req.params.id);
		wlogger.debug({ "OK getOne Centre: ": centre });
		return res.status(200).json(centre);
	} catch (error) {
		wlogger.error({ "ERROR getOne USER: ": error });
		return res.status(500).json(error);
	}
};

/** [PUT] /centres/1
 * 	UPDATE ONE
 *
 * 	@param {Centre} req.body the centre to update
 *  @param {string} id query param id of the centre
 *
 * 	@returns {} the 200 status code with a sequelize message if it was updated correctly
 */
exports.updateOne = async (req, res) => {
	try {
		wlogger.debug("updateOne: [PUT] /centres/:id");
		const reqCentre = req.body; //Centre
		const centre = await Centre.update(reqCentre, { where: { id: req.params.id } });
		wlogger.log({ level: 'info', message: { "OK updateOne Centre: ": centre } });
		return res.status(200).json(centre);
	} catch (error) {
		wlogger.log({ level: 'info', message: { "ERROR in updateOne: ": error } });
		return res.status(500).json(error);
	}
};

/** [DELETE] /centres/1
 *	DELETE ONE
 *
 * 	@param {string} req.params.id the centre to delete
 *
 * 	@returns {} the 200 status code with a sequelize message if it was deleted correctly
 */
exports.deleteOne = async (req, res) => {
	const t = await sequelize.transaction();
	try {
		wlogger.debug("deleteOne: [DELETE] /centres/:id");
		await Service.destroy({ where: { centre: req.params.id }, transaction: t });
		wlogger.debug({ "deleted services of centre: ": req.params.id });
		const centre = await Centre.destroy({ where: { id: req.params.id }, transaction: t });
		await t.commit();
		wlogger.debug({ "OK deleteOne Centre: ": centre });
		return res.status(200).json(centre);
	} catch (error) {
		wlogger.error({ "ERROR getdeleteOneOne Centre: ": error });
		await t.rollback();
		return res.status(500).json(error);
	}
};

getFakeRolling = () => {
    let obj = [];
	obj.push({text: 'S1, S2, S3 NTC 1 year'});
	obj.push({text: 'S1 NRT 1 month'});
	obj.push({text: 'S3 NRT/STC 1 month'});
	return obj;
};

getFakeDataSourcesInfo = () => {
    let obj = [];
	obj.push({text: 'Sentinel-1 NTC'});
	obj.push({text: 'Sentinel-2'});
	obj.push({text: 'Sentinel-3 OLCI'});
	obj.push({text: 'Sentinel-3 SLSTR'});
	obj.push({text: 'Sentinel-3 SRAL'});
	return obj;
};

/** [GET] /centres/1/rolling
 * 	GET rolling info. Please consider that this information comes from single instances or FE-Only instances
 *
 * 	@param {string} req.params.id id of the centre to get
 *
 * 	@returns {JSON} JSON Array with the list of rolling policies
 */
 exports.getRolling = async (req, res) => {
	wlogger.debug("getRolling: [GET] /centres/:id/rolling");
	
	try {
		let rollingInfo = [];
		let cleanRollingInfo;
		const services = await Service.findAll({
			where: {
				centre: req.params.id,
				service_type: {
					[Sequelize.Op.in]: [1, 2]  //Exclude BE services from Rolling Info 
				}
			}
		});
		let timeout;
		// for each service configured for a center, get the list of eviction
		for (const service of services) {
			const source = axios.CancelToken.source();
			let requestTimeout = (conf.getConfig().requestTimeout) ? conf.getConfig().requestTimeout : 30000;
			timeout = setTimeout(() => {
				source.cancel();
				wlogger.error("No response received from Service " + service.service_url); 
				wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
			}, requestTimeout);
			const eviction = await axios({
				method: 'get',
				url: urljoin(service.service_url, evictionUrl),
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
			if(eviction && eviction.status == 200 && eviction.data){

				wlogger.debug(eviction.data); 
				for (const element of eviction.data.value) {
					if (element.Cron.Active === true) {
						rollingInfo.push(utility.parseRollingInfo(element))
					}
				
				} 
				wlogger.info("rollingInfo before removing duplicates");
				wlogger.info(rollingInfo);
				cleanRollingInfo = rollingInfo.filter((arr, index, self) =>
    				index === self.findIndex((t) => (t.text === arr.text)))
				wlogger.info("rollingInfo after removing duplicates");
				wlogger.info(cleanRollingInfo);
				
			}
		}
		
		// parse response
		wlogger.debug({ "OK getRolling Centre: ": cleanRollingInfo });
		return res.status(200).json(cleanRollingInfo);
	} catch (error) {
		wlogger.error({ "ERROR getRolling: ": error });
		wlogger.error(error);
		return res.status(500).json(error);
	}
};

/** [GET] /centres/1/datasourcesinfo
 * 	GET Data sources info. Please consider that this information comes from single instances or BE-Only instances
 *
 * 	@param {string} req.params.id id of the centre to get
 *
 * 	@returns {JSON} JSON Array with the list of data sources info
 */
 exports.getDataSourcesInfo = async (req, res) => {
	wlogger.debug("getDataSourcesInfo: [GET] /centres/:id/datasourcesinfo");
	try {
		let dsInfo = [];
		let cleanDsInfo = [];
		//let centerServices = [];
		const services = await Service.findAll({
			where: {
				centre: req.params.id,
				service_type: {
					[Sequelize.Op.in]: [1, 3]  //Exclude FE services from DS Info 
				}
			}
		});
		const feServices = await Service.findAll({
			where: {
				centre: {
					[Sequelize.Op.ne]: req.params.id  //Exclude local service from DS Info matching synch results
				},
				service_type: {
					[Sequelize.Op.in]: [1, 2]  //Exclude BE services from DS Info matching synch results
				}
			}
		});
		// BUG SD-34 BEGIN
		//centerServices = services.filter((arr) => arr.centre == req.params.id);
		//wlogger.debug("center services are: ");
		//wlogger.debug(centerServices);
		let serviceUrls = feServices.map(x => x.service_url);
		wlogger.debug("serviceUrls are: ");
		wlogger.debug(serviceUrls);
		// for each service configured for a center, get the list of ds info
		for (const service of services) {			
			const sources = await utility.performDHuSServiceRequest(service, productSourcesUrl);
			wlogger.debug("Product Sources HTTP response");
			//console.log(sources);
			// Get info from odata/v1 synchronizers
			if (sources && sources.status == 404) {
				wlogger.info("Service " + service.service_url + " does not support Intelligent Synchronizers. Getting legacy synch list...")
				const synch = await utility.performDHuSServiceRequest(service, synchUrl);
				if(synch && synch.status == 200 && synch.data){

					wlogger.debug(synch.data.d.results); 
					const dataSourceStatus = (conf.getConfig().dataSourceStatus) ? conf.getConfig().dataSourceStatus : ["RUNNING", "PENDING"];
					for (const element of synch.data.d.results) {
						const synchServiceUrl = element.ServiceUrl.split('/odata')[0];
						if (dataSourceStatus.indexOf(element.Status) >= 0 && 
								(serviceUrls.indexOf(synchServiceUrl) >=0 || 
								serviceUrls.indexOf(synchServiceUrl + '/') >=0)) {
								let centreService = feServices.filter((arr) => arr.service_url.indexOf(synchServiceUrl)>=0);
								let centre;
								if (typeof centreService !== 'undefined' && centreService.length > 0) {
									centre = await Centre.findOne({
										where: {
											id: centreService[0].centre
										}
									});
								}
								
								dsInfo.push(utility.parseDataSourceInfo(element, centre))
						}						
					} 
					wlogger.debug("getDataSourcesInfo before removing duplicates is");
					wlogger.debug(dsInfo);
					cleanDsInfo = dsInfo.filter((arr, index, self) => {
						const _obj = JSON.stringify(arr);
						return index === self.findIndex(obj => {
						return JSON.stringify(obj) === _obj;
						})
						//index === self.findIndex((t) => (t.lastCreationDate === arr.lastCreationDate) && (t.info === arr.info) && (t.centre === arr.centre))
					})
					wlogger.debug("getDataSourcesInfo after removing duplicates is");
					wlogger.debug(cleanDsInfo);
				}
			} else if (sources && sources.status == 200 && sources.data) {
				sourceList = sources.data.value;
				wlogger.info("Service " + service.service_url + " is compliant with Intelligent Synchronizers. Getting synch list...")
				const intelliSynch = await utility.performDHuSServiceRequest(service, intelliSynchUrl);
				if(intelliSynch && intelliSynch.status == 200 && intelliSynch.data){

					wlogger.debug(intelliSynch.data.value); 
					// Check if Intelligent Synchronizer is Active from Cron.Active property
					
					for (const element of intelliSynch.data.value) {
						if (element.Cron.Active) {
							let referencedSources = element.ReferencedSources;
							wlogger.debug("referencedSources");
							wlogger.debug(referencedSources);
							for (rs of referencedSources) {
								let selectedSource = sourceList.filter((arr) =>rs.ReferenceId==arr.Id);
								
								if(selectedSource.length > 0 && typeof selectedSource[0] !== 'undefined') {
									// add all url of sources whose index is equal to ReferenceId (can contain repeated urls)
									try {
										// if a synch contains only one ReferncedSource, the Listable attribute is ignored, so add it to dsInfo 
										
										if(referencedSources.length == 1 || (referencedSources.length > 1 && selectedSource[0].Listable)) {
											
											
											const synchServiceUrl = selectedSource[0].Url.split('/odata')[0];

											if (serviceUrls.indexOf(synchServiceUrl) >=0 || 
												serviceUrls.indexOf(synchServiceUrl + '/') >=0) {
												let centreService = feServices.filter((arr) => arr.service_url.indexOf(synchServiceUrl)>=0);
												 
												let centre;
												if (typeof centreService !== 'undefined' && centreService.length > 0) {
													centre = await Centre.findOne({
														where: {
															id: centreService[0].centre
														}
													});
												}
												
												dsInfo.push(utility.parseV2DataSourceInfo(element, rs, selectedSource[0], centre))
											}

										} 
									} catch (e) {
										wlogger.error(e)
									}
								}			
							}	
						}
					}
					wlogger.debug("getDataSourcesInfo before removing duplicates is");
					wlogger.debug(dsInfo);
					cleanDsInfo = dsInfo.filter((arr, index, self) => {
						const _obj = JSON.stringify(arr);
						return index === self.findIndex(obj => {
						return JSON.stringify(obj) === _obj;
						})
						//index === self.findIndex((t) => (t.lastCreationDate === arr.lastCreationDate) && (t.info === arr.info) && (t.centre === arr.centre))
					})
					wlogger.debug("getDataSourcesInfo after removing duplicates is");
					wlogger.debug(cleanDsInfo);
				}

			} else {
				wlogger.info("Failed to retrieve sources and synch list for service " + service.service_url)
			}
		}
		
		// parse response
		wlogger.debug({ "OK getDataSourcesInfo Centre: ": cleanDsInfo });
		return res.status(200).json(cleanDsInfo);
	} catch (error) {
		wlogger.error({ "ERROR getDataSourcesInfo: ": error });
		wlogger.error(error);
		return res.status(500).json(error);
	}
};


/** [GET] /centres/1/map/datasourcesinfo
 * 	GET centres providing Data sources info. Please consider that this information comes from single instances or BE-Only instances
 *
 * 	@param {string} req.params.id id of the centre to get
 *
 * 	@returns {JSON} JSON Array with the list of centres providing data to "source" centre
 */
 exports.getMapDataSourcesInfo = async (req, res) => {
	wlogger.debug("getMapDataSourcesInfo: [GET] /centres/:id/map/datasourcesinfo");
	try {
		let dsInfo = [];
		let centres = [];
		const services = await Service.findAll({
			where: {
				centre: req.params.id,
				service_type: {
					[Sequelize.Op.in]: [1, 3]  //Exclude FE services from DS Info 
				}
			}
		});
		// for each service configured for a center, get the list of ds info
		for (const service of services) {
			
			const sources = await utility.performDHuSServiceRequest(service, productSourcesUrl);
				wlogger.debug("Product Sources HTTP response");
				//console.log(sources);
				// Get info from odata/v1 synchronizers
				if (sources && sources.status == 404) {
					wlogger.info("Service " + service.service_url + " does not support Intelligent Synchronizers. Getting legacy synch list...")
					const synch = await utility.performDHuSServiceRequest(service, selectSynchUrl);
					if(synch && synch.status == 200 && synch.data){

						wlogger.debug(synch.data.d.results); 
						const dataSourceStatus = (conf.getConfig().dataSourceStatus) ? conf.getConfig().dataSourceStatus : ["RUNNING", "PENDING"];
		
						for (const element of synch.data.d.results) {
							if (dataSourceStatus.indexOf(element.Status) >= 0) {
								// add both serviceUrl ending or not with slash, to facilitate the search on the DB from Synch results
								const synchServiceUrl = element.ServiceUrl.split('/odata')[0];
								dsInfo.push(synchServiceUrl);
								dsInfo.push(synchServiceUrl + '/');
							}
						
						}
						wlogger.debug("dsInfo from legacy synch is:  ");
						wlogger.debug(dsInfo);
						
					}
				} else if (sources && sources.status == 200 && sources.data) {

					sourceList = sources.data.value;
					wlogger.info("Service " + service.service_url + " is compliant with Intelligent Synchronizers. Getting synch list...")
					const intelliSynch = await utility.performDHuSServiceRequest(service, intelliSynchUrl);
					if(intelliSynch && intelliSynch.status == 200 && intelliSynch.data){

						wlogger.debug(intelliSynch.data.value); 
						// Check if Intelligent Synchronizer is Active from Cron.Active property
						for (const element of intelliSynch.data.value) {
							if (element.Cron.Active) {
								let referencedSources = element.ReferencedSources;
								wlogger.debug("referencedSources");
								wlogger.debug(referencedSources);
								for (rs of referencedSources) {
									let selectedSource = sourceList.filter((arr) =>rs.ReferenceId==arr.Id);
									if(selectedSource.length > 0 && typeof selectedSource[0] !== 'undefined') {
										// add all url of sources whose index is equal to ReferenceId (can contain repeated urls)
										try {
											// if a synch contains only one ReferncedSource, the Listable attribute is ignored, so add it to dsInfo 
											if(referencedSources.length == 1 || (referencedSources.length > 1 && selectedSource[0].Listable)) {
												const synchServiceUrl = selectedSource[0].Url.split('/odata')[0];
												dsInfo.push(synchServiceUrl);
												dsInfo.push(synchServiceUrl + '/');

											} 
										} catch (e) {
											wlogger.error(e)
										}
									}			
								}	
							}
						}
						wlogger.debug("dsInfo from intelligent synch is:  ");
						wlogger.debug(dsInfo);
					}
				} else {
					wlogger.info("Failed to retrieve sources and synch list for service " + service.service_url)
				}
			wlogger.debug("final dsInfo is:  ");
			wlogger.debug(dsInfo);
				
			
		}
		const service_centres = await Service.findAll({
			attributes:['centre'],
			where: {
				service_url: {
					[Sequelize.Op.in]: dsInfo  //Get the list of services metching the OData Synchronizers ServiceUrl
				},
				service_type: {
					[Sequelize.Op.in]: [1, 2]  //Exclude BE services from DS Info 
				}
			}
		});
		let centreIds = service_centres.map(centre => centre.centre);
		wlogger.debug("service_centres is:  ");
		wlogger.debug(centreIds);
		centres = await Centre.findAll({
			where: {
				[Sequelize.Op.or]: [
					{
					id: {
						[Sequelize.Op.in]: centreIds  //Get the list of Centres metching the Services retrieved by the OData Synch list
					}
				},{
				local: true
				}]
			}
		});
		wlogger.debug("centres is:  ");
		wlogger.debug(centres);
		
		// parse response
		wlogger.debug({ "OK getMapDataSourcesInfo Centre: ": centres });
		return res.status(200).json(centres);
	} catch (error) {
		wlogger.error({ "ERROR getMapDataSourcesInfo: ": error });
		wlogger.error(error);
		return res.status(500).json(error);
	}
};


/** [GET] /centres/1/map/dhsconnected
 * 	GET centres getting data from the "source" centre. 
 *
 * 	@param {string} req.params.id id of the source centre
 *
 * 	@returns {JSON} JSON Array with the list of centres getting data from the "source" centre. 
 */
 exports.getMapDhsConnected = async (req, res) => {
	wlogger.debug("getMapDhsConnected: [GET] /centres/:id/map/dhsconnected");
	try {
		let dsInfo = [];
		let centres = [];
		let centreServices = [];
		const services = await Service.findAll();
		wlogger.debug("services are");
		wlogger.debug(services);
		let timeout;
		// for each service configured for a center, get the list of ds info
		for (const service of services) {
			wlogger.debug("service.centre: " + service.centre);
			wlogger.debug("req.params.id: " + req.params.id);
			// get the list of service_url intersecting the configured services of a center (excluding the source centre)
			if(service.centre != req.params.id && service.service_type != 2 ) { //Exclude FE services and local services from the list 
				
				// Check if DHuS service support Intelligent Synchronizers by performing request to ProductSources entity
				const sources = await utility.performDHuSServiceRequest(service, productSourcesUrl);
				wlogger.debug("Product Sources HTTP response");
				//console.log(sources);
				// Get info from odata/v1 synchronizers
				if (sources && sources.status == 404) {
					wlogger.info("Service " + service.service_url + " does not support Intelligent Synchronizers. Getting legacy synch list...")
					const synch = await utility.performDHuSServiceRequest(service, selectSynchUrl);
					if(synch && synch.status == 200 && synch.data){

						wlogger.debug(synch.data.d.results); 
						const dataSourceStatus = (conf.getConfig().dataSourceStatus) ? conf.getConfig().dataSourceStatus : ["RUNNING", "PENDING"];
		
						for (const element of synch.data.d.results) {
							if (dataSourceStatus.indexOf(element.Status) >= 0) {
								// add both serviceUrl ending or not with slash, to facilitate the search on the DB from Synch results
								dsInfo.push({"centre": service.centre,"synch": element.ServiceUrl.split('/odata')[0]});
							}
						
						}
						
					}
				} else if (sources && sources.status == 200 && sources.data) {
					sourceList = sources.data.value;
					wlogger.info("Service " + service.service_url + " is compliant with Intelligent Synchronizers. Getting synch list...")
					const intelliSynch = await utility.performDHuSServiceRequest(service, intelliSynchUrl);
					if(intelliSynch && intelliSynch.status == 200 && intelliSynch.data){

						wlogger.debug(intelliSynch.data.value); 
						// Check if Intelligent Synchronizer is Active from Cron.Active property
						for (const element of intelliSynch.data.value) {
							if (element.Cron.Active) {
								let referencedSources = element.ReferencedSources;
								wlogger.debug("referencedSources");
								wlogger.debug(referencedSources);
								for (rs of referencedSources) {
									let selectedSource = sourceList.filter((arr) =>rs.ReferenceId==arr.Id);
									if(selectedSource.length > 0 && typeof selectedSource[0] !== 'undefined') {
										// add all url of sources whose index is equal to ReferenceId (can contain repeated urls)
										try {
											// if a synch contains only one ReferncedSource, the Listable attribute is ignored, so add it to dsInfo 
											if(referencedSources.length == 1 || (referencedSources.length > 1 && selectedSource[0].Listable)) {
												dsInfo.push({"centre": service.centre,"synch": selectedSource[0].Url.split('/odata')[0]});

											} 
										} catch (e) {
											wlogger.error(e)
										}
									}
										
								}	
							}
						
						}
					}
				} else {
					wlogger.info("Failed to retrieve sources and synch list for service " + service.service_url)
				}
				
			} else if (service.centre == req.params.id && service.service_type != 3) {  // get local services (excluding BE services)
				if (service.service_url.lastIndexOf('/') == service.service_url.length -1) {
					centreServices.push(service.service_url.slice(0, -1));
				} else {
					centreServices.push(service.service_url);
				}
			}
		}
		wlogger.debug("dsInfo is:  ");
		wlogger.debug(dsInfo);
		wlogger.debug("centreServices is:  ");
		wlogger.debug(centreServices);
		let filteredCentres = dsInfo.filter(function (ds) {
			return centreServices.indexOf(ds.synch) >= 0;
		  });
		wlogger.debug("filteredCentres is:  ");
		wlogger.debug(filteredCentres);
		let centreIds = filteredCentres.map(function(d) { return d["centre"]; });
		wlogger.debug("centresId is:  ");
		wlogger.debug(centreIds);
		centres = await Centre.findAll({
			where: {
				[Sequelize.Op.or]: [
					{
					id: {
						[Sequelize.Op.in]: centreIds  //Get the list of Centres metching the Services retrieved by the OData Synch list
					}
				},{
				local: true
				}]
			}
		});
		wlogger.debug("centres is:  ");
		wlogger.debug(centres);
		// parse response
		wlogger.debug({ "OK getMapDhsConnected Centre: ": centres });
		return res.status(200).json(centres);
	} catch (error) {
		wlogger.error({ "ERROR getMapDhsConnected: ": error });
		wlogger.error(error);
		return res.status(500).json(error);
	}
};

//Compute service availability related to provided date filters for the provided FE or Single Instance centre
// For all authenticated users
/* Request body example:
 * {
 	"startDate":"2021-11-05",
	"stopDate":"2021-11-06"
 * }
   Response example
   {
	"centreId": "1",
	"values": [{
			"date": "2022-02-27",
			"successResponses": 128,
			"totalRequests": 144,
			"percentage": 88.88888888888889,
			"average": 97,222222
		},
		{
			"date": "2022-02-27",
			"successResponses": 144,
			"totalRequests": 144,
			"percentage": 100,
			"average": 97,222222
		},
		{
			"date": "2022-03-01",
			"successResponses": 138,
			"totalRequests": 138,
			"percentage": 100,
			"average": 97,222222
		},
		{
			"date": "2022-03-02",
			"successResponses": 1,
			"totalRequests": 1,
			"percentage": 100,
			"average": 97,222222
		}]
	}
*/
exports.computeAvailability = async (req, res, next) => {
	let availability = {};
	//let query = "SELECT to_char(date_trunc('day', day),'YYYY-MM-DD') as date, count as \"successResponses\", total as \"totalRequests\", (count/total::float)*100 as percentage FROM ( SELECT date_trunc('day', timestamp) \"day\", count(*) total, sum(case when http_status_code between 200 and 499 then 1 else 0 end) count FROM service_availability WHERE timestamp >= ? and timestamp <= ? and centre_id = ? GROUP BY day) x ORDER BY day";
	let query = "SELECT to_char(date_trunc('day', day),'YYYY-MM-DD') as date, count as \"successResponses\", total as \"totalRequests\",(count/total::float)*100 percentage, (SELECT avg(count/total::float)*100 FROM (SELECT date_trunc('day', timestamp) \"day\", count(*) total, sum(case when http_status_code between 200 and 499 then 1 else 0 end) count FROM service_availability WHERE timestamp >= ? and timestamp <= ? and centre_id=? GROUP BY day) z ) average FROM ( SELECT date_trunc('day', timestamp) \"day\", count(*) total, sum(case when http_status_code between 200 and 499 then 1 else 0 end) count FROM service_availability WHERE timestamp >= ? and timestamp <= ? and centre_id=? GROUP BY day ) x ORDER BY day";
	wlogger.info("computeAvailability: [GET] /centres/:id/service/availability");
	try {
		if (isNaN(req.params.id)) {
			return res.status(400).json("Centre must be a number");
		}
		availability.centreId = req.params.id;
		wlogger.debug("request body");
		wlogger.debug(req.body);
		if (!req.body.startDate || !req.body.stopDate) {
			return res.status(400).json("Not valid Date range");
		}		
		if (!moment(req.body.startDate, "YYYY-MM-DDTHH:mm:ss", true).isValid() || !moment(req.body.stopDate, "YYYY-MM-DDTHH:mm:ss", true).isValid() ) {
			return res.status(400).json("Invalid Date Format")
		}
		if(req.body.startDate > req.body.stopDate) {
			return res.status(400).json("startDate must be greater or equal than stopDate");
		}
		
		wlogger.info("Compute availability between " + req.body.startDate + " and " + req.body.stopDate);
		
		// Add query to retrieve availability results
		const itemList = await sequelize.query(
			query,
			{
				replacements: [req.body.startDate, req.body.stopDate, req.params.id, req.body.startDate, req.body.stopDate, req.params.id],
				type: Sequelize.QueryTypes.SELECT
			}
		);
		availability.values = itemList;
		wlogger.debug("Daily Service Availability:");
		wlogger.debug(availability)
		return res.status(200).json(availability);
	} catch (error) {
		wlogger.error(error);
		return res.status(500).json(error);
	}
};


//Compute service availability related to provided date filters for the provided FE or Single Instance centre
// For all authenticated users
/* Request body example:
 * {
 	"startDate":"2021-11-05",
	"stopDate":"2021-11-06"
 * }
   Response example
   {
    "centreId": "2",
    "average": 47.61904761904761,
    "startDate": "2022-02-23",
    "stopDate": "2022-03-04"
   }
*/
exports.computeAverageAvailability = async (req, res, next) => {
	let availability = {};
	let query = "SELECT AVG(percentage) as average FROM(SELECT to_char(date_trunc('day', day),'YYYY-MM-DD') as day, count, total, (count/total::float)*100 percentage FROM ( SELECT date_trunc('day', timestamp) \"day\", count(*) total, sum(case when http_status_code between 200 and 499 then 1 else 0 end) count FROM service_availability WHERE timestamp >= ? and timestamp <= ? AND centre_id=? GROUP BY day) x ORDER BY day) y";
	wlogger.info("computeAverageAvailability: [GET] /centres/:id/service/availability/average");
	try {
		if (isNaN(req.params.id)) {
			return res.status(400).json("Centre must be a number");
		}
		availability.centreId = req.params.id;
		wlogger.debug("request body");
		wlogger.debug(req.body);
		if (!req.body.startDate || !req.body.stopDate) {
			return res.status(400).json("Not valid Date range");
		}		
		if (!moment(req.body.startDate, "YYYY-MM-DDTHH:mm:ss", true).isValid() || !moment(req.body.stopDate, "YYYY-MM-DDTHH:mm:ss", true).isValid() ) {
			return res.status(400).json("Invalid Date Format")
		}
		if(req.body.startDate > req.body.stopDate) {
			return res.status(400).json("startDate must be greater or equal than stopDate");
		}
		
		wlogger.info("Compute average availability between " + req.body.startDate + " and " + req.body.stopDate);
		
		// Add query to retrieve availability results
		const itemList = await sequelize.query(
			query,
			{
				replacements: [req.body.startDate, req.body.stopDate, req.params.id],
				type: Sequelize.QueryTypes.SELECT
			}
		);
		availability.average = itemList[0]['average'];
		availability.startDate = req.body.startDate;
		availability.stopDate = req.body.stopDate;
		wlogger.debug("Average Service Availability:");
		wlogger.debug(availability)
		return res.status(200).json(availability);
	} catch (error) {
		wlogger.error(error);
		return res.status(500).json(error);
	}
};

//Compute service latency related to provided date filters for the provided centre, BE Service and sync (identified by id/label)
// For all authenticated users
/* Request body example:
 * {
 	"startDate":"2021-11-05",
	"stopDate":"2021-11-06",
	"synchId": 0,
	"synchLabel": "S2B"
	"backendUrl": "https://apihub.copernicus.eu/apihub"
 * }
   Response example
   {
	"centreId": "1",
	"values": [{
		"day": "2022-04-02",
		"centre_id": 1,
		"synch_id": 1,
		"synch_label": "S2B",
		"average_fe": null,
		"average_be": 878656940.00000000,
		"number_of_measurements": 24
		}]
	}
*/
exports.computeLatency = async (req, res, next) => {
	let publication_latency = {};
	//let query = "select to_char(date_trunc('day', "timestamp"),'YYYY-MM-DD') as day, centre_id, synch_id, synch_label, avg(latency_fe) as average_fe, avg(latency_be) as average_be, avg(case when latency_fe is not null then latency_fe else latency_be end) average_latency, count(*) as number_of_measurements from publication_latency WHERE centre_id=? and synch_id=? and synch_label=? and backend_url = ? and(timestamp >= ? and timestamp <= ? ) group by day, centre_id, synch_id, synch_label";
	let query = "select to_char(date_trunc('day', \"timestamp\"),'YYYY-MM-DD') as day, centre_id, synch_id, synch_label, avg(latency_fe) as average_fe, avg(latency_be) as average_be, avg(case when latency_fe is not null then latency_fe else latency_be end) average_latency, count(*) as number_of_measurements from publication_latency WHERE centre_id=? and synch_id=? and synch_label=? and backend_url = ? and(timestamp >= ? and timestamp <= ? ) group by day, centre_id, synch_id, synch_label";
	wlogger.info("computeLatency: [GET] /centres/:id/service/latency/daily");
	try {
		if (isNaN(req.params.id)) {
			return res.status(400).json("Centre must be a number");
		}
		publication_latency.centreId = req.params.id;
		wlogger.debug("request body");
		wlogger.debug(req.body);
		if (!req.body.startDate || !req.body.stopDate) {
			return res.status(400).json("Not valid Date range");
		}		
		if (!moment(req.body.startDate, "YYYY-MM-DDTHH:mm:ss", true).isValid() || !moment(req.body.stopDate, "YYYY-MM-DDTHH:mm:ss", true).isValid() ) {
			return res.status(400).json("Invalid Date Format")
		}
		if(req.body.startDate > req.body.stopDate) {
			return res.status(400).json("startDate must be greater or equal than stopDate");
		}
		
		wlogger.info(`Compute publication latency between  ${req.body.startDate} and ${req.body.stopDate} for the sync ${req.body.synchId} - ${req.body.synchLabel}
		 of the BE ${req.body.backendUrl}` );
		
		// Add query to retrieve availability results
		const itemList = await sequelize.query(
			query,
			{
				replacements: [req.params.id, req.body.synchId, req.body.synchLabel, req.body.backendUrl, req.body.startDate, req.body.stopDate],
				type: Sequelize.QueryTypes.SELECT
			}
		);
		publication_latency.values = itemList;
		wlogger.debug("Daily Publication Layency:");
		wlogger.debug(publication_latency)
		return res.status(200).json(publication_latency);
	} catch (error) {
		wlogger.error(error);
		return res.status(500).json(error);
	}
};

//Compute service latency daily details related to provided date for the provided centre, BE Service and sync (identified by id/label)
// For all authenticated users
/* Request body example:
 * {
 	"date":"2021-11-05",
	"synchId": 0,
	"synchLabel": "S2B"
	"backendUrl": "https://apihub.copernicus.eu/apihub"
 * }
   Response example
   {
	"centreId": "1",
	"values": [{
		"timezone": "2022-04-11 13:09:30",
		"centre_id": 1,
		"synch_id": 1,
		"synch_label": "S2B",
		"average_fe": null,
		"average_be": 856016551
		},{
		"timezone": "2022-04-11 13:23:57",
		"centre_id": 1,
		"synch_id": 1,
		"synch_label": "S2B",
		"average_fe": null,
		"average_be": 857024401
		},{
		"timezone": "2022-04-11 13:44:50",
		"centre_id": 1,
		"synch_id": 1,
		"synch_label": "S2B",
		"average_fe": null,
		"average_be": 857922853
		}]
	}
*/
exports.computeLatencyDetails = async (req, res, next) => {
	let publication_latency = {};
	//let query = "select timestamp at time zone 'UTC', centre_id, synch_id, synch_label, latency_fe, latency_be from publication_latency WHERE centre_id=? and synch_id=? and synch_label=? and backend_url = ? and date_trunc('day', "timestamp") = ? group by timestamp, centre_id, synch_id, synch_label, latency_fe, latency_be";
	let query = "select timestamp at time zone 'UTC', centre_id, synch_id, synch_label, latency_fe, latency_be from publication_latency WHERE centre_id=? and synch_id=? and synch_label=? and backend_url = ? and date_trunc('day', \"timestamp\") = ? group by timestamp, centre_id, synch_id, synch_label, latency_fe, latency_be";
	wlogger.info("computeLatencyDetails: [GET] /centres/:id/service/latency/daily/details");
	try {
		if (isNaN(req.params.id)) {
			return res.status(400).json("Centre must be a number");
		}
		publication_latency.centreId = req.params.id;
		wlogger.debug("request body");
		wlogger.debug(req.body);
		if (!req.body.date) {
			return res.status(400).json("Not valid Date");
		}		
		if (!moment(req.body.date, "YYYY-MM-DD", true).isValid() ) {
			return res.status(400).json("Invalid Date Format")
		}
		
		wlogger.info(`Compute publication latency details in the date ${req.body.date} for the sync ${req.body.synchId} - ${req.body.synchLabel}
		 of the BE ${req.body.backendUrl}` );
		
		// Add query to retrieve availability results
		const itemList = await sequelize.query(
			query,
			{
				replacements: [req.params.id, req.body.synchId, req.body.synchLabel, req.body.backendUrl, req.body.date],
				type: Sequelize.QueryTypes.SELECT
			}
		);
		publication_latency.values = itemList;
		wlogger.debug("Daily Publication Layency Details:");
		wlogger.debug(publication_latency)
		return res.status(200).json(publication_latency);
	} catch (error) {
		wlogger.error(error);
		return res.status(500).json(error);
	}
};