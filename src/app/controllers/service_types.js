//Models imports
const ServiceType = require("../models/service_type");

//Util imports
const wlogger = require('../util/wlogger');

/*******************************************************
 * CRUD CONTROLLERS																		 *
 *******************************************************/

/** [POST] /servicetypes
 *  CREATE ONE
 *
 * Mandatory fields for Database insert (allowNull: false):
 * @param {string} req.body.service_type service type
 * @returns {ServiceType} the service type created, status 201
 */
exports.createOne = async (req, res, next) => {
	try {
		wlogger.debug("createOne: [POST] /servicetypes/");
		const servicetype = await ServiceType.create({
			service_type: req.body.service_type,
		});
		wlogger.debug({ "createOne ServiceType: ": servicetype });
		return res.status(201).json(servicetype);
	} catch (error) {
		wlogger.error({ "ERROR createOne ServiceType:": error });
		return res.status(500).json(error);
	}
};


//GET-ALL 
exports.getAll = async (req, res, next) => {
	try {
		let servicetype;
		servicetype = await ServiceType.findAll({
				order: [['service_type', 'ASC']],
			});
		wlogger.info({ "OK getAll ServiceType:": servicetype });
		return res.status(200).json(servicetype);
	} catch (error) {
		wlogger.error(error);
		return res.status(500).json(error);
	}
};


/** [GET] /servicetypes/1
 * 	GET ONE
 *
 * 	@param {string} req.params.id id of the ServiceType to get
 *
 * 	@returns {ServiceType} the service with the id requested
 */
exports.getOne = async (req, res) => {
	wlogger.debug("getOne: [GET] /servicetypes/:id");
	try {
		const s = await ServiceType.findByPk(req.params.id);
		wlogger.debug({ "OK getOne ServiceType: ": s });
		return res.status(200).json(s);
	} catch (error) {
		wlogger.error({ "ERROR getOne ServiceType: ": error });
		return res.status(500).json(error);
	}
};

/** [PUT] /servicetypes/1
 * 	UPDATE ONE
 *
 * 	@param {ServiceType} req.body the ServiceType to update
 *  @param {string} id query param id of the ServiceType
 *
 * 	@returns {} the 200 status code with a sequelize message if it was updated correctly
 */
exports.updateOne = async (req, res) => {
	try {
		wlogger.debug("updateOne: [PUT] /servicetypes/:id");
		const S = req.body; //ServiceType
		const s = await ServiceType.update(S, { where: { id: req.params.id } });
		wlogger.log({ level: 'info', message: { "OK updateOne ServiceType: ": s } });
		return res.status(200).json(s);
	} catch (error) {
		wlogger.log({ level: 'info', message: { "ERROR in updateOne: ": error } });
		return res.status(500).json(error);
	}
};

/** [DELETE] /servicetypes/1
 *	DELETE ONE
 *
 * 	@param {string} req.params.id the service to delete
 *
 * 	@returns {} the 200 status code with a sequelize message if it was deleted correctly
 */
exports.deleteOne = async (req, res) => {
	try {
		wlogger.debug("deleteOne: [DELETE] /servicetypes/:id");
		const s = await ServiceType.destroy({ where: { id: req.params.id } });
		wlogger.debug({ "OK deleteOne ServiceType: ": s });
		return res.status(200).json(s);
	} catch (error) {
		wlogger.error({ "ERROR getdeleteOneOne ServiceType: ": error });
		return res.status(500).json(error);
	}
};


