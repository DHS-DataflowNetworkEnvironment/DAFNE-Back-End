//Models imports
const axios = require('axios');
const moment = require('moment');
const Sequelize = require('sequelize');
const Centre = require("app/models/centre");
const Service = require("app/models/service");
const sequelize = require('app/util/database');
const Utilcrypto = require('app/util/utilcrypto');
const utility = require('app/util/utility');
const wlogger = require('app/util/wlogger');
const conf = require('app/util/config');
const ingestersController = require('app/controllers/ingesters');

const evictionUrl = '/Evictions';
const synchUrl = '/Synchronizers';
const selectSynchUrl = '/Synchronizers?$select=ServiceUrl,Status';
const productSourcesUrl = '/ProductSources';
const intelliSynchUrl = '/Synchronizers?$expand=ReferencedSources';

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
		wlogger.info({ "createOne Centre: ": centre });
		return res.status(201).json(centre);
	} catch (error) {
		wlogger.error({ "ERROR createOne Centre:": error });
		return res.status(500).json(error);
	}
};


//GET-ALL
exports.getAll = async (req, res, next) => {
	try {
		let centres;
		centres = await Centre.findAll({
				order: [['name', 'ASC']],
			});
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
		wlogger.info("updateOne: [PUT] /centres/:id");
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
		wlogger.info({ "deleted services of centre: ": req.params.id });
		const centre = await Centre.destroy({ where: { id: req.params.id }, transaction: t });
		await t.commit();
		wlogger.info({ "OK deleteOne Centre: ": centre });
		return res.status(200).json(centre);
	} catch (error) {
		wlogger.error({ "ERROR getdeleteOneOne Centre: ": error });
		await t.rollback();
		return res.status(500).json(error);
	}
};

/** [GET] /local-centre
 * 	GET LOCAL CENTRE
 *
 * 	@returns {Centre} the centre with local == true
 */
exports.getLocalCentreName = async (req, res) => {
  //wlogger.debug("getLocalCentre: [GET] /local-centre");
	try {
		const centre = await Centre.findOne({
      where: {
        local: true
      }
    });
    if (!centre) {
      return res.status(404).json({ message: 'There is no local centre set' });
    }
    const centreName = centre.dataValues.name;
		return centreName;
	} catch (error) {
		wlogger.error({ "ERROR getOne USER: ": error });
		return res.status(500).json(error);
	}
}

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
 * 	GET rolling info.
 *
 * 	@param {string} req.params.id id of the centre to get
 *
 * 	@returns {JSON} JSON Array with the list of rolling policies
 */
 exports.getRolling = async (req, res, next) => {
	wlogger.debug("getRolling: [GET] /centres/:id/rolling");
	
	try {
    // Get Rolling policy referred to the local centre:
    const evictionsResponse = {
      status: () => ({
        json: (payload) => payload
      })
    };
    const evictionList = await ingestersController.getAllEvictions(req, evictionsResponse, next);
    const evictionStatus = evictionList.status;
    let evictionObjArray = [];
    if (evictionStatus === 'RUNNING') {
      let evictionPolicies = evictionList.evictionPolicies;
      wlogger.debug("ROLLING: Eviction Policies: " + JSON.stringify(evictionPolicies, null, 2));
      const consumersResponse = {
        status: () => ({
          json: (payload) => payload
        })
      };
      const consumersList = await ingestersController.getAllConsumers(req, consumersResponse, next);
      const producersResponse = {
        status: () => ({
          json: (payload) => payload
        })
      };
      const producersList = await ingestersController.getAllProducers(req, producersResponse, next);
      for(const evictionPolicyEl of evictionPolicies) {
        const evictionConsumers = consumersList.filter(consumerEl => consumerEl.taskList.find(task => task.targetStores === evictionPolicyEl.storeGroupName));
        const evictionTopics = evictionConsumers.map(consumer => consumer.topics);
        let evictionProducers = [];
        for (const topics of evictionTopics) {
          const producers = producersList.filter(producer => topics.includes(producer.topic));
          evictionProducers = evictionProducers.concat(producers);
        }
        let producerFilters = [];
        for (const producer of evictionProducers) {
          producerFilters.push(producer.source.filter);
        }
        evictionObjArray.push({evictionPolicy: evictionPolicyEl, filters: producerFilters});
      }
    }

    
		return res.status(200).json(evictionObjArray);
	} catch (error) {
		wlogger.error({ "ERROR getRolling: ": error });
		wlogger.error(error);
		return res.status(500).json(error);
	}
};

/** [GET] /centres/1/datasourcesinfo
 * 	GET Data sources info.
 *
 * 	@param {string} req.params.id id of the centre to get
 *
 * 	@returns {JSON} JSON Array with the list of data sources info
 */
exports.getDataSourcesInfo = async (req, res, next) => {
	wlogger.debug("getDataSourcesInfo: [GET] /centres/:id/datasourcesinfo");
  try {
    let dsInfo = [];

    // Get all services of CDSE or GSS type:
    const services = await Service.findAll({
			where: {
				service_type: {
					[Sequelize.Op.in]: [4, 8]
				}
			}
		});
    // Get all producers referred to the local centre:
    const producersResponse = {
      status: () => ({
        json: (payload) => payload
      })
    };
    const producers = await ingestersController.getAllProducers(req, producersResponse, next);

    // Get all consumers referred to the local centre:
    const consumersResponse = {
      status: () => ({
        json: (payload) => payload
      })
    };
    const consumers = await ingestersController.getAllConsumers(req, consumersResponse, next);

    // Object to store all producers and consumers of the local GSS:
    const localIngestersDataSources = {producers: [], consumers: []};
    producers.forEach((producerItem) => {
      if (producerItem.name && producerItem.source && producerItem.topic && producerItem.source.serviceRootUrl && producerItem.source.lastPublicationDate && producerItem.source.filter) {
        localIngestersDataSources.producers.push({ingesterName: producerItem.name, topic: producerItem.topic, serviceRootUrl: producerItem.source.serviceRootUrl, lastPublicationDate: producerItem.source.lastPublicationDate, filter: producerItem.source.filter });
      }
    });
    consumers.forEach((consumerItem) => {
      if (consumerItem.name && consumerItem.source && consumerItem.topics && consumerItem.source.serviceRootUrl) {
        localIngestersDataSources.consumers.push({ingesterName: consumerItem.name, topics: consumerItem.topics, serviceRootUrl: consumerItem.source.serviceRootUrl });
      }
    });
    
    // Get All Ingesters instances to check which is Running:
    const ingestersResponse = {
      status: () => ({
        json: (payload) => payload
      })
    };
    const allLocalIngesters = await ingestersController.getAllIngesters(req, ingestersResponse, next);
    if (allLocalIngesters && allLocalIngesters.length > 0) {
      const localIngestersRunningInstances = allLocalIngesters.filter((instance) => instance.state === 'RUNNING');
      for (const localDsProducerItem of localIngestersDataSources.producers) {
        const localProducerRunningInstance = localIngestersRunningInstances.some((instance) => instance.name === localDsProducerItem.ingesterName);
        if (localProducerRunningInstance) {
          const producerTopic = localDsProducerItem.topic;
          for (const localDsConsumerItem of (localIngestersDataSources.consumers.filter(consumerSourceObj => consumerSourceObj.serviceRootUrl === localDsProducerItem.serviceRootUrl) || [])) {
            if (localDsConsumerItem.topics.includes(producerTopic)) {
              const localConsumerRunningInstance = localIngestersRunningInstances.some((instance) => instance.name === localDsConsumerItem.ingesterName);
              if (localConsumerRunningInstance) {
                // Once a matching running producer and consumer have been found, record the dsInfo.
                const dsProducerItemService = services.find((s) => {
                  return localDsProducerItem.serviceRootUrl.includes(s.service_url);
                });
                if (!dsProducerItemService) {
                  wlogger.warn("No service found for producer: " + JSON.stringify(localDsProducerItem, null, 2));
                  return res.status(404).json({ message: 'No service found for producer: ' + localDsProducerItem.ingesterName });
                }
                const dsProducerItemCentre = await Centre.findOne({
                  where: {
                    id: dsProducerItemService.centre
                  }
                });
                dsInfo.push({
                  info: localDsProducerItem.ingesterName,
                  filter: localDsProducerItem.filter,
                  lastCreationDate: localDsProducerItem.lastPublicationDate,
                  centre: dsProducerItemCentre
                });
              }
            }
          }
        }
      }
    }
    //wlogger.debug("getDataSourcesInfo: " + JSON.stringify(dsInfo, null, 2));
		return res.status(200).json(dsInfo);
	} catch (error) {
		wlogger.error({ "ERROR getDataSourcesInfo: ": error });
		wlogger.error(error);
		return res.status(500).json(error);
	}
}


/** [GET] /centres/1/dhsconnected
 * 	GET DHS Connected.
 *
 * 	@param {string} req.params.id id of the centre to get
 *
 * 	@returns {JSON} JSON Array with the list of dhs connected
 */
exports.getDhsConnected = async (req, res, next) => {
	wlogger.debug("getDhsConnected: [GET] /centres/:id/dhsconnected");
  wlogger.debug("req.params: " + JSON.stringify(req.params, null, 2));

  let dhsConnected = [];
  try {
    const centre = await Centre.findOne({
      where: {
        local: true
      }
    });
    if (!centre) {
      return res.status(404).json({ message: 'There is no local centre set' });
    }
    const localServiceList = await Service.findAll({
      where: {
        centre: centre.id,
        service_type: 8  //Get only GSS services
      }
    });
    if (localServiceList && localServiceList.length > 0) {
      localService = localServiceList[0];

      // Get all producers referred to the external centres:
      const allProducersExtResponse = {
        status: () => ({
          json: (payload) => payload
        })
      };
      const allProducersExt = await ingestersController.getAllProducersExt(req, allProducersExtResponse, next);
      const allProducersExtFiltered = allProducersExt
        .map(item => ({
          ...item,
          producers: item.producers.filter(
            producer => producer.source.serviceRootUrl === localService.service_url
          )
        }))
        .filter(item => item.producers.length > 0);
      const allProducersNames = allProducersExtFiltered.map(producerObj => producerObj.producers.map(producer => producer.name)).flat();

      // Get all consumers referred to the external centres:
      const allConsumersExtResponse = {
        status: () => ({
          json: (payload) => payload
        })
      };
      const allConsumersExt = await ingestersController.getAllConsumersExt(req, allConsumersExtResponse, next);
      const allConsumersExtFiltered = allConsumersExt
        .map(item => ({
          ...item,
          consumers: item.consumers.filter(
            consumer => consumer.source.serviceRootUrl === localService.service_url
          )
        }))
        .filter(item => item.consumers.length > 0);
      const allConsumersNames = allConsumersExtFiltered.map(consumerObj => consumerObj.consumers.map(consumer => consumer.name)).flat();

      // Get all ingesters referred to the external centres:
      const allIngestersExtResponse = {
        status: () => ({
          json: (payload) => payload
        })
      };
      const allIngestersExt = await ingestersController.getAllIngestersExt(req, allIngestersExtResponse, next);
      const allIngestersExtFiltered = allIngestersExt
        .map(item => ({
          ...item,
          instances: item.instances.filter(
            ingester => allProducersNames.includes(ingester.name) || allConsumersNames.includes(ingester.name)
          )
        }))
        .filter(item => item.instances.length > 0);


      const allIngestersExtFilteredConsumers = allIngestersExtFiltered
        .map(item => ({
          ...item,
          instances: item.instances.filter(ingester => allConsumersNames.includes(ingester.name))
        }))
        .filter(item => item.instances.length > 0);
      const allIngestersExtFilteredProducers = allIngestersExtFiltered
        .map(item => ({
          ...item,
          instances: item.instances.filter(ingester => allProducersNames.includes(ingester.name))
        }))
        .filter(item => item.instances.length > 0);


      for (const producerSourceObj of allProducersExtFiltered) {
        for (const producer of producerSourceObj.producers) {
          const producerTopic = producer.topic;
          for (const consumer of allConsumersExtFiltered.find(consumerSourceObj => consumerSourceObj.service.id === producerSourceObj.service.id)?.consumers || []) {
            if (consumer.topics.includes(producerTopic)) {

              let ingesterConsumerRunning = null;
              for (const consumerInstance of allIngestersExtFilteredConsumers.map(item => item.instances).flat()) {
                if (consumerInstance.name === consumer.name) {
                  if (consumerInstance.hasOwnProperty('state') && consumerInstance.state === 'RUNNING') {
                    ingesterConsumerRunning = consumerInstance;
                  }
                }
              }
              let ingesterProducerRunning = null;
              for (const producerInstance of allIngestersExtFilteredProducers.map(item => item.instances).flat()) {
                if (producerInstance.name === producer.name) {
                  if (producerInstance.hasOwnProperty('state') && producerInstance.state === 'RUNNING') {
                    ingesterProducerRunning = producerInstance;
                  }
                }
              }

              if (ingesterConsumerRunning && ingesterProducerRunning) {
                // Both consumer and producer are running
                dhsConnected.push({ service: producerSourceObj.service, centre: producerSourceObj.service.centre, consumer: ingesterConsumerRunning, producer: ingesterProducerRunning });
              }
            }
          }
        }
      }
    }
    return res.status(200).json(dhsConnected);
  } catch (error) {
		wlogger.error({ "ERROR getDhsConnected: ": error });
		wlogger.error(error);
		return res.status(500).json(error);
	}
}



/** [GET] /centres/1/map/datasourcesinfo
 * 	GET centres providing Data sources info.
 *
 * 	@param {string} req.params.id id of the centre to get
 *
 * 	@returns {JSON} JSON Array with the list of centres providing data to "source" centre
 */
 exports.getMapDataSourcesInfo = async (req, res, next) => {
	wlogger.debug("getMapDataSourcesInfo: [GET] /centres/:id/map/datasourcesinfo");
	try {
		let dsInfo = [];
		let centres = [];
		const services = await Service.findAll({
			where: {
				service_type: {
					[Sequelize.Op.in]: [4, 8]  //Get only CDSE or GSS types
				}
			}
		});
		
    // Get all producers referred to the local centre:
    const producersResponse = {
      status: () => ({
        json: (payload) => payload
      })
    };
    const producers = await ingestersController.getAllProducers(req, producersResponse, next);

    // Get all consumers referred to the local centre:
    const consumersResponse = {
      status: () => ({
        json: (payload) => payload
      })
    };
    const consumers = await ingestersController.getAllConsumers(req, consumersResponse, next);

    const ingestersDataSources = {producers: [], consumers: []};
    producers.forEach((producerItem) => {
      if (producerItem.name && producerItem.source && producerItem.topic && producerItem.source.serviceRootUrl && producerItem.source.lastPublicationDate && producerItem.source.filter) {
        ingestersDataSources.producers.push({ingesterName: producerItem.name, topic: producerItem.topic, serviceRootUrl: producerItem.source.serviceRootUrl, lastPublicationDate: producerItem.source.lastPublicationDate, filter: producerItem.source.filter });
      }
    });
    consumers.forEach((consumerItem) => {
      if (consumerItem.name && consumerItem.source && consumerItem.topics && consumerItem.source.serviceRootUrl) {
        ingestersDataSources.consumers.push({ingesterName: consumerItem.name, topics: consumerItem.topics, serviceRootUrl: consumerItem.source.serviceRootUrl });
      }
    });

    // Get All Ingesters instances to check which is Running:
    const ingestersResponse = {
      status: () => ({
        json: (payload) => payload
      })
    };
    const allIngesters = await ingestersController.getAllIngesters(req, ingestersResponse, next);
    if (allIngesters && allIngesters.length > 0) {
      const ingestersRunningInstances = allIngesters.filter((instance) => instance.state === 'RUNNING');
      for (const dsProducerItem of ingestersDataSources.producers) {
        if (ingestersRunningInstances.some((instance) => instance.name === dsProducerItem.ingesterName)) {
          const dsProducerItemService = services.find((s) => {
            return dsProducerItem.serviceRootUrl.includes(s.service_url);
          });
          const dsProducerItemCentre = await Centre.findOne({
            where: {
              id: dsProducerItemService.centre
            }
          });
          dsInfo.push({
            info: dsProducerItem.ingesterName,
            filter: dsProducerItem.filter,
            lastCreationDate: dsProducerItem.lastPublicationDate,
            centre: dsProducerItemCentre
          });
        }
      }
    }

    const localCentre = await Centre.findOne({
        where: {
          local: true
        }
      });
    centres = dsInfo.map((ds) => ds.centre);
    if (centres.length > 0) {
      centres.push(localCentre);
    }
		
		return res.status(200).json(centres);
	} catch (error) {
		wlogger.error({ "ERROR getMapDataSourcesInfo: ": error });
		wlogger.error(error);
		return res.status(500).json(error);
	}
};


//Compute service availability related to provided date filters for the local centre
// For all authenticated users
exports.computeAvailability = async (req, res, next) => {
	let availability = {};
	let query = "SELECT to_char(date_trunc('day', day),'YYYY-MM-DD') as date, count as \"successResponses\", total as \"totalRequests\",(count/total::float)*100 percentage, (SELECT SUM(COUNT::float) / SUM(TOTAL::float)*100 FROM (SELECT date_trunc('day', timestamp) \"day\", count(*) total, sum(case when http_status_code between 200 and 499 then 1 else 0 end) count FROM service_availability WHERE timestamp >= ? and timestamp <= ? and centre_id=? GROUP BY day) z ) average FROM ( SELECT date_trunc('day', timestamp) \"day\", count(*) total, sum(case when http_status_code between 200 and 499 then 1 else 0 end) count FROM service_availability WHERE timestamp >= ? and timestamp <= ? and centre_id=? GROUP BY day ) x ORDER BY day";
	wlogger.info("computeAvailability: [GET] /centres/:id/service/availability");
	try {
		if (isNaN(req.params.id)) {
			return res.status(400).json("Centre must be a number");
		}
		availability.centreId = req.params.id;
		//wlogger.debug("request body");
		//wlogger.debug(req.body);
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

//Compute weekly service availability related to provided date filters for the local centre
// For all authenticated users
exports.computeAvailabilityWeekly = async (req, res, next) => {
	let availability = {};
	let query = "SELECT to_char(date_trunc('week', week),'YYYY-MM-DD') as date, count as \"successResponses\", total as \"totalRequests\",(count/total::float)*100 percentage, (SELECT SUM(COUNT::float) / SUM(TOTAL::float)*100 FROM (SELECT date_trunc('week', timestamp) \"week\", count(*) total, sum(case when http_status_code between 200 and 499 then 1 else 0 end) count FROM service_availability WHERE timestamp >= ? and timestamp <= ? and centre_id=? GROUP BY week) z ) average FROM ( SELECT date_trunc('week', timestamp) \"week\", count(*) total, sum(case when http_status_code between 200 and 499 then 1 else 0 end) count FROM service_availability WHERE timestamp >= ? and timestamp <= ? and centre_id=? GROUP BY week ) x ORDER BY week";
	wlogger.info("computeAvailabilityWeekly: [GET] /centres/:id/service/availability/weekly");
	try {
		if (isNaN(req.params.id)) {
			return res.status(400).json("Centre must be a number");
		}
		availability.centreId = req.params.id;
		//wlogger.debug("request body");
		//wlogger.debug(req.body);
		if (!req.body.startDate || !req.body.stopDate) {
			return res.status(400).json("Not valid Date range");
		}		
		if (!moment(req.body.startDate, "YYYY-MM-DDTHH:mm:ss", true).isValid() || !moment(req.body.stopDate, "YYYY-MM-DDTHH:mm:ss", true).isValid() ) {
			return res.status(400).json("Invalid Date Format")
		}
		if(req.body.startDate > req.body.stopDate) {
			return res.status(400).json("startDate must be greater or equal than stopDate");
		}
		
		wlogger.info("Compute weekly availability between " + req.body.startDate + " and " + req.body.stopDate);
		
		// Add query to retrieve availability results
		const itemList = await sequelize.query(
			query,
			{
				replacements: [req.body.startDate, req.body.stopDate, req.params.id, req.body.startDate, req.body.stopDate, req.params.id],
				type: Sequelize.QueryTypes.SELECT
			}
		);
		availability.values = itemList;
		wlogger.debug("Weekly Service Availability:");
		wlogger.debug(availability)
		return res.status(200).json(availability);
	} catch (error) {
		wlogger.error(error);
		return res.status(500).json(error);
	}
};


//Compute service availability related to provided date filters for the local centre
// For all authenticated users
exports.computeAverageAvailability = async (req, res, next) => {
	let availability = {};
	let query = "SELECT AVG(percentage) as average FROM(SELECT to_char(date_trunc('day', day),'YYYY-MM-DD') as day, count, total, (count/total::float)*100 percentage FROM ( SELECT date_trunc('day', timestamp) \"day\", count(*) total, sum(case when http_status_code between 200 and 499 then 1 else 0 end) count FROM service_availability WHERE timestamp >= ? and timestamp <= ? AND centre_id=? GROUP BY day) x ORDER BY day) y";
	wlogger.info("computeAverageAvailability: [GET] /centres/:id/service/availability/average");
	try {
		if (isNaN(req.params.id)) {
			return res.status(400).json("Centre must be a number");
		}
		availability.centreId = req.params.id;
		//wlogger.debug("request body");
		//wlogger.debug(req.body);
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

//Compute service timeliness related to provided date filters for the provided centre
// For all authenticated users
exports.computeTimeliness = async (req, res, next) => {
	let publication_timeliness = {};
	let query = "select to_char(date_trunc('day', \"timestamp\"),'YYYY-MM-DD') as day, centre_id, filter_label, avg(timeliness::float) as average_timeliness, count(*) as number_of_measurements from publication_timeliness WHERE centre_id=? and filter_label=? and source_url = ? and(timestamp >= ? and timestamp <= ? ) group by day, centre_id, filter_label";
  wlogger.info("computeTimeliness: [GET] /centres/:id/service/timeliness/daily");
	try {
		if (isNaN(req.params.id)) {
			return res.status(400).json("Centre must be a number");
		}
		publication_timeliness.centreId = req.params.id;
		//wlogger.debug("request body");
		//wlogger.debug(req.body);
		if (!req.body.startDate || !req.body.stopDate) {
			return res.status(400).json("Not valid Date range");
		}		
		if (!moment(req.body.startDate, "YYYY-MM-DDTHH:mm:ss", true).isValid() || !moment(req.body.stopDate, "YYYY-MM-DDTHH:mm:ss", true).isValid() ) {
			return res.status(400).json("Invalid Date Format")
		}
		if(req.body.startDate > req.body.stopDate) {
			return res.status(400).json("startDate must be greater or equal than stopDate");
		}
		
		wlogger.info(`Compute publication timeliness between  ${req.body.startDate} and ${req.body.stopDate} for the filter ${req.body.filterLabel} on source ${req.body.localUrl}` );
		
		// Add query to retrieve availability results
		const itemList = await sequelize.query(
			query,
			{
				replacements: [req.params.id, req.body.filterLabel, req.body.localUrl, req.body.startDate, req.body.stopDate],
				type: Sequelize.QueryTypes.SELECT
			}
		);
		publication_timeliness.values = itemList;
		wlogger.debug("Daily Publication Timeliness:");
		wlogger.debug(publication_timeliness)
		return res.status(200).json(publication_timeliness);
	} catch (error) {
		wlogger.error(error);
		return res.status(500).json(error);
	}
};

//Compute weekly service timeliness related to provided date filters for the provided centre
// For all authenticated users
exports.computeTimelinessWeekly = async (req, res, next) => {
	let publication_timeliness = {};
	let query = "select to_char(date_trunc('week', \"timestamp\"),'YYYY-MM-DD') as day, centre_id, filter_label, avg(timeliness::float) as average_timeliness, count(*) as number_of_measurements from publication_timeliness WHERE centre_id=? and filter_label=? and source_url = ? and(timestamp >= ? and timestamp <= ? ) group by day, centre_id, filter_label";
  wlogger.info("computeTimelinessWeekly: [GET] /centres/:id/service/timeliness/weekly");
	try {
		if (isNaN(req.params.id)) {
			return res.status(400).json("Centre must be a number");
		}
		publication_timeliness.centreId = req.params.id;
		//wlogger.debug("request body");
		//wlogger.debug(req.body);
		if (!req.body.startDate || !req.body.stopDate) {
			return res.status(400).json("Not valid Date range");
		}		
		if (!moment(req.body.startDate, "YYYY-MM-DDTHH:mm:ss", true).isValid() || !moment(req.body.stopDate, "YYYY-MM-DDTHH:mm:ss", true).isValid() ) {
			return res.status(400).json("Invalid Date Format")
		}
		if(req.body.startDate > req.body.stopDate) {
			return res.status(400).json("startDate must be greater or equal than stopDate");
		}
		
		wlogger.info(`Compute publication timeliness between  ${req.body.startDate} and ${req.body.stopDate} for the filter ${req.body.filterLabel} on source ${req.body.localUrl}` );
		
		// Add query to retrieve availability results
		const itemList = await sequelize.query(
			query,
			{
				replacements: [req.params.id, req.body.filterLabel, req.body.localUrl, req.body.startDate, req.body.stopDate],
				type: Sequelize.QueryTypes.SELECT
			}
		);
		publication_timeliness.values = itemList;
		wlogger.debug("Weekly Publication Timeliness:");
		wlogger.debug(publication_timeliness)
		return res.status(200).json(publication_timeliness);
	} catch (error) {
		wlogger.error(error);
		return res.status(500).json(error);
	}
};

//Compute service timeliness daily details related to provided date for the provided centre
// For all authenticated users
exports.computeTimelinessDetails = async (req, res, next) => {
	let publication_timeliness = {};
	let query = "select timestamp at time zone 'UTC', centre_id, filter_label, timeliness::float from publication_timeliness WHERE centre_id=? and filter_label=? and source_url = ? and date_trunc('day', \"timestamp\") = ? group by timestamp, centre_id, filter_label, timeliness";
  wlogger.info("computeTimelinessDetails: [GET] /centres/:id/service/timeliness/daily/details");
	try {
		if (isNaN(req.params.id)) {
			return res.status(400).json("Centre must be a number");
		}
		publication_timeliness.centreId = req.params.id;
		//wlogger.debug("request body");
		//wlogger.debug(req.body);
		if (!req.body.date) {
			return res.status(400).json("Not valid Date");
		}		
		if (!moment(req.body.date, "YYYY-MM-DD", true).isValid() ) {
			return res.status(400).json("Invalid Date Format")
		}
		
		wlogger.info(`Compute publication timeliness details in the date ${req.body.date} for the filter ${req.body.filterLabel} on source ${req.body.localUrl}` );
		
		// Add query to retrieve availability results
		const itemList = await sequelize.query(
			query,
			{
				replacements: [req.params.id, req.body.filterLabel, req.body.localUrl, req.body.date],
				type: Sequelize.QueryTypes.SELECT
			}
		);
		publication_timeliness.values = itemList;
		//wlogger.debug("Daily Publication Timeliness Details:");
		//wlogger.debug(publication_timeliness)
		return res.status(200).json(publication_timeliness);
	} catch (error) {
		wlogger.error(error);
		return res.status(500).json(error);
	}
};