//Models imports
const Service = require("../models/service");

//Util imports
const wlogger = require('../util/wlogger');
const Utilcrypto = require('../util/Utilcrypto');
const utility = require('../util/utility');

const getSynchronizersUrl = 'odata/v2/Synchronizers';
const getProductSourcesUrl = '/odata/v2/ProductSources';

/*******************************************************
 * CRUD CONTROLLERS																		 *
 *******************************************************/

/** [POST] /services
 *  CREATE ONE
 *
 * Mandatory fields for Database insert (allowNull: false):
 * @param {string} req.body.username username
 * @param {string} req.body.password password. will be stored encrypted with proper algorithm
 * @param {string} req.body.service_url service_url
 * @param {string} req.body.token_url token_url
 * @param {int} req.body.service_type service_type (reference to service_type model, id field)
 * @param {string} req.body.centre service's centre
 * @returns {Service} the service created, status 201
 */
exports.createOne = async (req, res, next) => {
	try {
		wlogger.debug("createOne: [POST] /services/");
		wlogger.debug("Body: ");
		wlogger.debug(req.body);
		const service = await Service.create({
			username: req.body.username,
			password: Utilcrypto.encrypt(req.body.password), //Encypted by default
			service_url: req.body.service_url,
			token_url: req.body.token_url,
			service_type: req.body.service_type,
			centre: req.body.centre,
		});
		wlogger.debug({ "createOne Service: ": service.service_url });
		return res.status(201).json(service);
	} catch (error) {
		wlogger.error({ "ERROR createOne Service:": error });
		wlogger.error(error);
		return res.status(500).json(error);
	}
};


//GET-ALL 
// TODO: verify if it is needed, if yes for admin only
exports.getAll = async (req, res, next) => {
	try {
		let services;
		services = await Service.findAll({
				order: [['service_url', 'ASC']],
			});
		return res.status(200).json(services);
	} catch (error) {
		wlogger.error(error);
		return res.status(500).json(error);
	}
};


/** [GET] /services/1
 * 	GET ONE
 *
 * 	@param {string} req.params.id id of the service to get
 *
 * 	@returns {Service} the service with the id requested
 */
exports.getOne = async (req, res) => {
	wlogger.debug("getOne: [GET] /services/:id");
	try {
		const s = await Service.findByPk(req.params.id);
		return res.status(200).json(s);
	} catch (error) {
		wlogger.error({ "ERROR getOne Service: ": error });
		wlogger.error(error);
		return res.status(500).json(error);
	}
};

/** [PUT] /services/1
 * 	UPDATE ONE
 *
 * 	@param {Service} req.body the Service to update
 *  @param {string} id query param id of the Service
 *
 * 	@returns {} the 200 status code with a sequelize message if it was updated correctly
 */
exports.updateOne = async (req, res) => {
	try {
		wlogger.debug("updateOne: [PUT] /services/:id");
		let S = req.body; //Service
		const password = S.password;
		if (password !== null && password !== undefined && password !== '') {
			console.log("not empty")
			S.password = Utilcrypto.encrypt(password)
		} else {
			console.log(password);
			delete S.password;
		}
		const s = await Service.update(S, { where: { id: req.params.id } });
		wlogger.log({ level: 'info', message: { "OK updateOne Service: ": s } });
		return res.status(200).json(s);
	} catch (error) {
		wlogger.log({ level: 'info', message: { "ERROR in updateOne: ": error } });
		wlogger.error(error);
		return res.status(500).json(error);
	}
};

/** [DELETE] /services/1
 *	DELETE ONE
 *
 * 	@param {string} req.params.id the service to delete
 *
 * 	@returns {} the 200 status code with a sequelize message if it was deleted correctly
 */
exports.deleteOne = async (req, res) => {
	try {
		wlogger.debug("deleteOne: [DELETE] /services/:id");
		const s = await Service.destroy({ where: { id: req.params.id } });
		wlogger.debug({ "OK deleteOne Service: ": s });
		return res.status(200).json(s);
	} catch (error) {
		wlogger.error({ "ERROR getdeleteOneOne Service: ": error });
		wlogger.error(error);
		return res.status(500).json(error);
	}
};


/** [GET] /services/1/synchronizers
 * 	GET ONE
 *
 * 	@param {string} req.params.id id of the service to get
 *
 * 	@returns {Synchronizers} List of Synchronizers of the service with the id requested
 */
 exports.getSynchronizers = async (req, res) => {
	wlogger.debug("getSynchronizers: [GET] /services/:id/synchronizers");
	try {
		const s = await Service.findByPk(req.params.id);
		const synchList = await utility.performDHuSServiceRequest(s, getSynchronizersUrl);
		if(synchList && synchList.status == 200 && synchList.data ) { 
			return res.status(200).json(synchList.data.value);
		} else {
			return res.status(500).json("Error Getting Synchronizers list");
		}		
	} catch (error) {
		wlogger.error({ "ERROR getSynchronizers Service: ": error });
		wlogger.error(error);
		return res.status(500).json(error);
	}
};

/** [GET] /services/1/synchronizers/intelligentSyncSupport
 *
 * 	@param {string} req.params.id id of the service to get
 *
 * 	@returns {boolean} if intelligent synchronizers are supported or not
 */
 exports.geIntelligentSyncSupport = async (req, res) => {
	wlogger.debug("geIntelligentSyncSupport: [GET] /services/:id/synchronizers/intelligentSyncSupport");
	try {
		const s = await Service.findByPk(req.params.id);
		const sources = await utility.performDHuSServiceRequest(s, getProductSourcesUrl);
		wlogger.debug("geIntelligentSyncSupport - Product Sources HTTP response");
		//console.log(sources);
		// Get info from odata/v1 synchronizers
		if (sources && sources.status == 404) {
			return res.status(200).json(false);
		} else {
			return res.status(200).json(true);
		}			
	} catch (error) {
		wlogger.error({ "ERROR geIntelligentSyncSupport Service: ": error });
		wlogger.error(error);
		return res.status(500).json(error);
	}
};
