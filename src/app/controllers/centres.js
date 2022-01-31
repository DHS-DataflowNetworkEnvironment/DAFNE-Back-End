//Models imports
const axios = require('axios');
const Centre = require("../models/centre");
const Service = require("../models/service");
const Sequelize = require('sequelize');
const sequelize = require('../util/database');
const urljoin = require('url-join');
const Utilcrypto = require('../util/Utilcrypto');
const utility = require('../util/utility');
const wlogger = require('../util/wlogger');
const conf = require('../util/config');

const evictionUrl = 'odata/v2/Evictions';
const synchUrl = 'odata/v1/Synchronizers'
const selectSynchUrl = 'odata/v1/Synchronizers?$select=ServiceUrl,Status'


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
		let timeout;
		for (const service of services) {

			const source = axios.CancelToken.source();
			let requestTimeout = (conf.getConfig().requestTimeout) ? conf.getConfig().requestTimeout : 30000;
			timeout = setTimeout(() => {
				source.cancel();
				wlogger.error("No response received from Service " + service.service_url); 
				wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
			}, requestTimeout);
			const synch = await axios({
				method: 'get',
				url: urljoin(service.service_url, synchUrl),
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
		let timeout;
		for (const service of services) {
			const source = axios.CancelToken.source();
			let requestTimeout = (conf.getConfig().requestTimeout) ? conf.getConfig().requestTimeout : 30000;
			timeout = setTimeout(() => {
				source.cancel();
				wlogger.error("No response received from Service " + service.service_url); 
				wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
			}, requestTimeout);
			const synch = await axios({
				method: 'get',
				url: urljoin(service.service_url, selectSynchUrl),
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
				const dataSourceStatus = (conf.getConfig().dataSourceStatus) ? conf.getConfig().dataSourceStatus : ["RUNNING", "PENDING"];

				// get the list of service_url intersecting the configured services of a center (excluding the source centre)
				for (const element of synch.data.d.results) {
					if (dataSourceStatus.indexOf(element.Status) >= 0) {
						// add both serviceUrl ending or not with slash, to facilitate the search on the DB from Synch results
						const synchServiceUrl = element.ServiceUrl.split('/odata')[0];
						dsInfo.push(synchServiceUrl);
						dsInfo.push(synchServiceUrl + '/');
					}
				
				}
				wlogger.debug("dsInfo is:  ");
				wlogger.debug(dsInfo);
				
			}
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
		let timeout;
		// for each service configured for a center, get the list of ds info
		for (const service of services) {
			wlogger.debug("service.centre: " + service.centre);
			wlogger.debug("req.params.id: " + req.params.id);
			if(service.centre != req.params.id && service.service_type != 2 ) { //Exclude FE services and local services from the list 
				const source = axios.CancelToken.source();
				let requestTimeout = (conf.getConfig().requestTimeout) ? conf.getConfig().requestTimeout : 30000;
				timeout = setTimeout(() => {
					source.cancel();
					wlogger.error("No response received from Service " + service.service_url); 
					wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
				}, requestTimeout);
				const synch = await axios({
					method: 'get',
					url: urljoin(service.service_url, selectSynchUrl),
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
					const dataSourceStatus = (conf.getConfig().dataSourceStatus) ? conf.getConfig().dataSourceStatus : ["RUNNING", "PENDING"];
	
					// get the list of service_url intersecting the configured services of a center (excluding the source centre)
					for (const element of synch.data.d.results) {
						if (dataSourceStatus.indexOf(element.Status) >= 0) {
							// add both serviceUrl ending or not with slash, to facilitate the search on the DB from Synch results
							dsInfo.push({"centre": service.centre,"synch": element.ServiceUrl.split('/odata')[0]});
						}
					
					}
					
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
