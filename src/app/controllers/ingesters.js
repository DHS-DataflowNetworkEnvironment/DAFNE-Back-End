//Models imports
const axios = require('axios');
const Sequelize = require('sequelize');
const Centre = require("app/models/centre");
const ServiceType = require("app/models/service_type");
const Service = require("app/models/service");
const Utilcrypto = require('app/util/utilcrypto');
const utility = require('app/util/utility');
const wlogger = require('app/util/wlogger');
const conf = require('app/util/config');
const jwt = require('jsonwebtoken');
const authConfig = require('app/controllers/auth');
const service_token = require('app/services/service_token');
const { response } = require('express');

let localService = null;
const urlTopParameter = "?top=100";

// GET INGESTORS ELEMENTS LISTS
//Get Data for Ingestors helper:
async function getDataForIngestersHelper() {
	try {
		const centre = await Centre.findOne({
			where: {
				local: true
			}
		});

    if (!centre) {
      wlogger.error("No local centre found.");
      return;
    }

		const localServiceList = await Service.findAll({
			where: {
				centre: centre.id,
				service_type: 8  //Get only GSS services
			}
		});

    if (localServiceList && localServiceList.length > 0) {
      localService = localServiceList[0];
    } else {
      wlogger.error("No local service of type GSS found.");
      return;
    }
  } catch (err) {
    wlogger.error("Error occurred while fetching service data for ingestors: " + err);
    return;
  }
  return true;
}

exports.getServiceDataForIngesters = async (req, res, next) => {
  wlogger.debug("Getting localService and serviceToken for ingestors");
  try {
    const helperRes = await getDataForIngestersHelper();
    if (helperRes) {
      return res.status(200).json("Service Data has been retrieved successfully");
    }
    wlogger.error("Failed to retrieve service data");
    return res.status(404).json({"message": "Failed to retrieve service data", "details": "Please check the service configuration."});
  } catch (err) {
    wlogger.error("ERROR getting localService and serviceToken for ingestors: " + err);
    return res.status(err.status || 500).json(err);
  }
}


//Get all datastores of the local Centre
// For all authenticated users
exports.getAllDatastores = async (req, res, next) => {
  let datastoresObj = {data: {datastores: []}};
  let requestTimeout = (conf.getConfig().requestTimeout) ? conf.getConfig().requestTimeout : 30000;
  const controller = new AbortController();
  if (!localService) {
    await this.getServiceDataForIngesters(req, res, next);
  }
  let timeout = setTimeout(() => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
    wlogger.error("No response received from Service while getting Datastores. " + localService.service_url); 
    wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
  }, requestTimeout);
	try {
    let datastoresUrlArray = [];
    conf.getConfig().ingesters.datastores.typeList.forEach(type => {
      datastoresUrlArray.push((new URL(localService.service_admin_url + "/datastores/" + type.url + urlTopParameter)));
    });
    const serviceToken = await service_token.getServiceToken(localService);
    const responses = await Promise.all(
      datastoresUrlArray.map(url => axios({
        method: 'get',
        url: url.href,
        headers: {
          'Authorization': 'Bearer '+ serviceToken.access_token
        },
        signal: controller.signal
      }))
    )
    if (responses) {
      datastoresObj.data.datastores = responses.flatMap(r => r.data);
    }
    clearTimeout(timeout);  
		return res.status(200).json(datastoresObj.data.datastores);
	} catch (err) {
    clearTimeout(timeout);
    if (axios.isCancel(err) || err.name === 'CanceledError') {
      return;
    }
    wlogger.error("Error from Service while getting datastores " + localService.service_admin_url); 
		wlogger.error("ERROR getAllDatastores: " + err);
		return res.status(err.response?.status || 500).json(err);
	}
};

//Get all metadatastores of the local Centre
// For all authenticated users
exports.getAllMetadatastores = async (req, res, next) => {
  let metadatastoresObj = {data: {metadatastores: []}};  
	let requestTimeout = (conf.getConfig().requestTimeout) ? conf.getConfig().requestTimeout : 30000;
  const controller = new AbortController();
  if (!localService) {
    await this.getServiceDataForIngesters(req, res, next);
  }
  let timeout = setTimeout(() => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
    wlogger.error("No response received from Service while getting Metadatastores. " + localService.service_url); 
    wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
  }, requestTimeout);
	try {
    const url = (new URL(localService.service_admin_url + "/metadatastores/solr" + urlTopParameter));
    const serviceToken = await service_token.getServiceToken(localService);
    const response = await axios({
      method: 'get',
      url: url.href,
      headers: {
        'Authorization': 'Bearer '+ serviceToken.access_token
      },
      signal: controller.signal
    })
    if (response) {
      metadatastoresObj.data.metadatastores = response.data;
    }
    clearTimeout(timeout);    
		return res.status(200).json(metadatastoresObj.data.metadatastores);
	} catch (err) {
    clearTimeout(timeout);
    if (axios.isCancel(err) || err.name === 'CanceledError') {
      return;
    }
    wlogger.error("Error from Service while getting metadatastores " + localService.service_admin_url); 
		wlogger.error("ERROR getAllMetadatastores: " + err);
		return res.status(err.response?.status || 500).json(err);
	}
};

//Get all credentials of the local Centre
// For all authenticated users
exports.getAllCredentials = async (req, res, next) => {
  let credentialsObj = {data: {credentials: []}};  
	let requestTimeout = (conf.getConfig().requestTimeout) ? conf.getConfig().requestTimeout : 30000;
  const controller = new AbortController();
  if (!localService) {
    await this.getServiceDataForIngesters(req, res, next);
  }
  let timeout = setTimeout(() => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
    wlogger.error("No response received from Service while getting Credentials. " + localService.service_url); 
    wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
  }, requestTimeout);
	try {
    let credentialsUrlArray = [];
    conf.getConfig().ingesters.credentials.typeList.forEach(type => {
      credentialsUrlArray.push((new URL(localService.service_admin_url + "/" + type.url + urlTopParameter)));
    });
    const serviceToken = await service_token.getServiceToken(localService);
    const responses = await Promise.all(
      credentialsUrlArray.map(url => axios({
        method: 'get',
        url: url.href,
        headers: {
          'Authorization': 'Bearer '+ serviceToken.access_token
        },
        signal: controller.signal
      }))
    )
    if (responses) {
      credentialsObj.data.credentials = responses.flatMap(r => r.data);
    }
    clearTimeout(timeout);
		return res.status(200).json(credentialsObj.data.credentials);
	} catch (err) {
    clearTimeout(timeout);  
    if (axios.isCancel(err) || err.name === 'CanceledError') {
      return;
    }
    wlogger.error("Error from Service while getting credentials " + localService.service_admin_url); 
		wlogger.error("ERROR getAllCredentials: " + err);
		return res.status(err.response?.status || 500).json(err);
	}
};

//Get all producers of the local Centre
// For all authenticated users
exports.getAllProducers = async (req, res, next) => {
  let producersObj = {data: {producers: []}};
	let requestTimeout = (conf.getConfig().requestTimeout) ? conf.getConfig().requestTimeout : 30000;
  const controller = new AbortController();
  if (!localService) {
    await this.getServiceDataForIngesters(req, res, next);
  }
  let timeout = setTimeout(() => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
    wlogger.error("No response received from Service while getting Producers. " + localService.service_url); 
    wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
  }, requestTimeout);
	try {
    const url = (new URL(localService.service_admin_url + "/producers" + urlTopParameter));
    const serviceToken = await service_token.getServiceToken(localService);
    const response = await axios({
      method: 'get',
      url: url.href,
      headers: {
        'Authorization': 'Bearer '+ serviceToken.access_token
      },
      signal: controller.signal
    })
    if (response) {
      producersObj.data = response.data;
    }
    clearTimeout(timeout);  
		return res.status(200).json(producersObj.data.producers);
	} catch (err) {
    clearTimeout(timeout);  
		if (axios.isCancel(err) || err.name === 'CanceledError') {
      return;
    }
    wlogger.error("Error from Service while getting producers " + localService.service_admin_url); 
		wlogger.error("ERROR getAllProducers: " + err);
		return res.status(err.response?.status || 500).json(err);
	}
};

//Get all producers of the external Centres for all authenticated users
exports.getAllProducersExt = async (req, res, next) => {
  let extServiceList = null;
  try {
		const centre = await Centre.findOne({
			where: {
				local: true
			}
		});

    if (!centre) {
      wlogger.error("No local centre found.");
      return res.status(404).json({ error: "No local centre found." });
    }

		extServiceList = await Service.findAll({
			where: {
				centre: {
            [Sequelize.Op.ne]: centre.id
        },
				service_type: 8  //Get only GSS services
			}
		});
  } catch (err) {
    wlogger.error("Error occurred while fetching services: " + err);
    return res.status(err.response?.status || 500).json({"message": "Error occurred while fetching services", "details": err});
  }

  let producersObjTot = {data: {producers: []}};
  if (extServiceList && extServiceList.length > 0) {
    for (const extService of extServiceList) {
      if (!extService.service_admin_url) {
        wlogger.info("Service admin URL is not defined for service: " + extService.id + " - Not processing for external producers.");
        continue;
      }
      let requestTimeout = (conf.getConfig().requestTimeout) ? conf.getConfig().requestTimeout : 30000;
      const controller = new AbortController();
      let timeout = setTimeout(() => {
        if (!controller.signal.aborted) {
          controller.abort();
        }
        wlogger.error("No response received from Service while getting Producers. " + extService.service_url); 
        wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
      }, requestTimeout);
      try {
        const url = (new URL(extService.service_admin_url + "/producers" + urlTopParameter));
        const serviceToken = await service_token.getServiceToken(extService);
        const bearer = serviceToken.access_token;
        const response = await axios({
          method: 'get',
          url: url.href,
          headers: {
            'Authorization': 'Bearer '+ bearer
          },
          signal: controller.signal
        })
        clearTimeout(timeout);
        if (response) {
          producersObjTot.data.producers.push({service: extService, producers: response.data.producers});
        }
      } catch (err) {
        clearTimeout(timeout);  
        if (axios.isCancel(err) || err.name === 'CanceledError') {
          return res.status(408).json({"message": "Request timeout"});
        }
        wlogger.error("Error from Service while getting producers " + extService.service_admin_url); 
        wlogger.error("ERROR getAllProducers: " + err);
        return res.status(err.response?.status || 500).json({"message": "Error occurred while fetching producers", "details": err});
      }
    }
    return res.status(200).json(producersObjTot.data.producers);
  } else {
    return res.status(200).json([]);
  }
};

//Get all consumers of the local Centre
// For all authenticated users
exports.getAllConsumers = async (req, res, next) => {
  let consumersObj = {data: {consumers: []}};
	let requestTimeout = (conf.getConfig().requestTimeout) ? conf.getConfig().requestTimeout : 30000;
  const controller = new AbortController();
  if (!localService) {
    await this.getServiceDataForIngesters(req, res, next);
  }
  let timeout = setTimeout(() => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
    wlogger.error("No response received from Service while getting Consumers. " + localService.service_url); 
    wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
  }, requestTimeout);
	try {
    const url = (new URL(localService.service_admin_url + "/consumers" + urlTopParameter)); 
    const serviceToken = await service_token.getServiceToken(localService);
    const response = await axios({
      method: 'get',
      url: url.href,
      headers: {
        'Authorization': 'Bearer '+ serviceToken.access_token
      },
      signal: controller.signal
    })
    if (response) {
      consumersObj.data = response.data;
    }
    clearTimeout(timeout);  
		return res.status(200).json(consumersObj.data.consumers);
	} catch (err) {
    clearTimeout(timeout);  
		if (axios.isCancel(err) || err.name === 'CanceledError') {
      return;
    }
    wlogger.error("Error from Service while getting consumers " + localService.service_admin_url); 
		wlogger.error("ERROR getAllConsumers: " + err);
		return res.status(err.response?.status || 500).json(err);
	}
};

//Get all consumers of the external Centres for all authenticated users
exports.getAllConsumersExt = async (req, res, next) => {
  let extServiceList = null;
  try {
		const centre = await Centre.findOne({
			where: {
				local: true
			}
		});

    if (!centre) {
      wlogger.error("No local centre found.");
      return res.status(404).json({ error: "No local centre found." });
    }

		extServiceList = await Service.findAll({
			where: {
				centre: {
            [Sequelize.Op.ne]: centre.id
        },
				service_type: 8  //Get only GSS services
			}
		});
  } catch (err) {
    wlogger.error("Error occurred while fetching services: " + err);
    return res.status(err.response?.status || 500).json({"message": "Error occurred while fetching services", "details": err});
  }

  let consumersObjTot = {data: {consumers: []}};
  if (extServiceList && extServiceList.length > 0) {
    for (const extService of extServiceList) {
      if (!extService.service_admin_url) {
        wlogger.info("Service admin URL is not defined for service: " + extService.id + " - Not processing for external consumers.");
        continue;
      }
      let requestTimeout = (conf.getConfig().requestTimeout) ? conf.getConfig().requestTimeout : 30000;
      const controller = new AbortController();
      let timeout = setTimeout(() => {
        if (!controller.signal.aborted) {
          controller.abort();
        }
        wlogger.error("No response received from Service while getting Consumers. " + extService.service_url); 
        wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
      }, requestTimeout);
      try {
        const url = (new URL(extService.service_admin_url + "/consumers" + urlTopParameter));
        const serviceToken = await service_token.getServiceToken(extService);
        const bearer = serviceToken.access_token;
        const response = await axios({
          method: 'get',
          url: url.href,
          headers: {
            'Authorization': 'Bearer '+ bearer
          },
          signal: controller.signal
        })
        clearTimeout(timeout);
        if (response) {
          consumersObjTot.data.consumers.push({service: extService, consumers: response.data.consumers});
        }
      } catch (err) {
        clearTimeout(timeout);  
        if (axios.isCancel(err) || err.name === 'CanceledError') {
          return res.status(408).json({"message": "Request timeout"});
        }
        wlogger.error("Error from Service while getting consumers " + extService.service_admin_url); 
        wlogger.error("ERROR getAllConsumers: " + err);
        return res.status(err.response?.status || 500).json({"message": "Error occurred while fetching consumers", "details": err});
      }
    }
    return res.status(200).json(consumersObjTot.data.consumers);
  } else {
    return res.status(200).json([]);
  }
};

//Get datastores types
exports.getDatastoresTypes = async (req, res, next) => {
  const typesList = conf.getConfig().ingesters.datastores.typeList ?? [];
  return res.status(200).json(typesList);
}

//Get all Ingesters:
exports.getAllIngesters = async (req, res, next) => {
  let response;
  let requestTimeout = (conf.getConfig().requestTimeout) ? conf.getConfig().requestTimeout : 30000;
  const controller = new AbortController();
  if (!localService) {
    await this.getServiceDataForIngesters(req, res, next);
  }
  let timeout = setTimeout(() => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
    wlogger.error("No response received from Service while getting all Ingesters. " + localService.service_url); 
    wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
  }, requestTimeout);
	try {
    const url = new URL(localService.service_admin_url + "/ingesters-management");
    const serviceToken = await service_token.getServiceToken(localService);
    response = await axios({
      method: 'get',
      url: url.href,
      headers: {
        'Authorization': 'Bearer '+ serviceToken.access_token
      },
      signal: controller.signal
    })
    clearTimeout(timeout);
    if (response.data && response.data.instances) {
      return res.status(response.status).json(response.data.instances);
    } else {
      return res.status(404).json({ message: "No ingesters found" });
    }
  } catch (err) {
    clearTimeout(timeout);  
		if (axios.isCancel(err) || err.name === 'CanceledError') {
      return;
    }
    wlogger.error("Error from Service " + localService.service_admin_url + "while getting all Ingesters"); 
		wlogger.error("ERROR getting all Ingesters: " + err);
		return res.status(err.response?.status || 500).json(err);
	}
}

//Get all Ingesters External:
exports.getAllIngestersExt = async (req, res, next) => {
  let extServiceList = null;
  try {
		const centre = await Centre.findOne({
			where: {
				local: true
			}
		});

    if (!centre) {
      wlogger.error("No local centre found.");
      return res.status(404).json({ error: "No local centre found." });
    }

		extServiceList = await Service.findAll({
			where: {
				centre: {
            [Sequelize.Op.ne]: centre.id
        },
				service_type: 8  //Get only GSS services
			}
		});
  } catch (err) {
    wlogger.error("Error occurred while fetching services: " + err);
    return res.status(err.response?.status || 500).json({"message": "Error occurred while fetching services", "details": err});
  }

  let ingestersObjTot = {data: {ingesters: []}};
  if (extServiceList && extServiceList.length > 0) {
    for (const extService of extServiceList) {
      if (!extService.service_admin_url) {
        wlogger.info("Service admin URL is not defined for service: " + extService.id + " - Not processing for external ingesters.");
        continue;
      }
      let response;
      let requestTimeout = (conf.getConfig().requestTimeout) ? conf.getConfig().requestTimeout : 30000;
      const controller = new AbortController();
      let timeout = setTimeout(() => {
        if (!controller.signal.aborted) {
          controller.abort();
        }
        wlogger.error("No response received from Service while getting all Ingesters. " + extService.service_url); 
        wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
      }, requestTimeout);
      try {
        const url = new URL(extService.service_admin_url + "/ingesters-management");
        const serviceToken = await service_token.getServiceToken(extService);
        const bearer = serviceToken.access_token;
        response = await axios({
          method: 'get',
          url: url.href,
          headers: {
            'Authorization': 'Bearer '+ bearer
          },
          signal: controller.signal
        })
        clearTimeout(timeout);
        if (response.data && response.data.instances) {
          ingestersObjTot.data.ingesters.push({service: extService, instances: response.data.instances});
        } else {
          return res.status(404).json({ message: "No ingesters found" });
        }
      } catch (err) {
        clearTimeout(timeout);  
        if (axios.isCancel(err) || err.name === 'CanceledError') {
          return;
        }
        wlogger.error("Error from Service " + extService.service_admin_url + " while getting all Ingesters"); 
        wlogger.error("ERROR getting all Ingesters: " + err);
        return res.status(err.response?.status || 500).json(err);
      }
    }
    return res.status(200).json(ingestersObjTot.data.ingesters);
  } else {
    return res.status(200).json([]);
  }
}


//Get all evictions of the local Centre
// For all authenticated users
exports.getAllEvictions = async (req, res, next) => {
  let evictionsObj = {data: {evictions: {}}};
	let requestTimeout = (conf.getConfig().requestTimeout) ? conf.getConfig().requestTimeout : 30000;
  const controller = new AbortController();
  if (!localService) {
    await this.getServiceDataForIngesters(req, res, next);
  }
  let timeout = setTimeout(() => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
    wlogger.error("No response received from Service while getting Evictions. " + localService.service_url); 
    wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
  }, requestTimeout);
	try {
    const url = (new URL(localService.service_admin_url + "/eviction")); 
    const serviceToken = await service_token.getServiceToken(localService);
    const response = await axios({
      method: 'get',
      url: url.href,
      headers: {
        'Authorization': 'Bearer '+ serviceToken.access_token
      },
      signal: controller.signal
    })
    //wlogger.debug("response: " + JSON.stringify(response.data, null, 2));
    if (response) {
      evictionsObj.data = response.data;
    }
    clearTimeout(timeout);  
		return res.status(200).json(evictionsObj.data);
	} catch (err) {
    clearTimeout(timeout);  
		if (axios.isCancel(err) || err.name === 'CanceledError') {
      return;
    }
    wlogger.error("Error from Service while getting evictions " + localService.service_admin_url); 
		wlogger.error("ERROR getAllEvictions: " + err);
		return res.status(err.response?.status || 500).json(err);
	}
};




// CREATE
//Create Datastore:
exports.createDatastore = async (req, res, next) => {
  let response;
  let requestTimeout = (conf.getConfig().requestTimeout) ? conf.getConfig().requestTimeout : 30000;
  const controller = new AbortController();
  if (!localService) {
    await this.getServiceDataForIngesters(req, res, next);
  }
  let timeout = setTimeout(() => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
    wlogger.error("No response received from Service while creating a Datastore. " + localService.service_url); 
    wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
  }, requestTimeout);
	try {
    const dsPath = conf.getConfig().ingesters.datastores.typeList.find(typeEl => typeEl.type === req.body.type).url;
    const url = (new URL(localService.service_admin_url + "/datastores/" + dsPath)); 
    const serviceToken = await service_token.getServiceToken(localService);
    wlogger.info("Creating datastore on url: " + url);
    wlogger.debug(JSON.stringify(req.body, null, 2));
    response = await axios({
      method: 'post',
      url: url.href,
      data: req.body,
      headers: {
        'Authorization': 'Bearer '+ serviceToken.access_token,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    })
    clearTimeout(timeout);
    return res.status(response.status).json(response.message);
  } catch (err) {
    clearTimeout(timeout);  
		if (axios.isCancel(err) || err.name === 'CanceledError') {
      return;
    }
    wlogger.error("Error from Service " + localService.service_admin_url + "while creating datastore " + req.body.name); 
		wlogger.error("ERROR creating datastore: " + err);
		return res.status(err.response?.status || 500).json(err);
	}
}

//Create Metadatastore:
exports.createMetadatastore = async (req, res, next) => {
  let response;
  let requestTimeout = (conf.getConfig().requestTimeout) ? conf.getConfig().requestTimeout : 30000;
  const controller = new AbortController();
  if (!localService) {
    await this.getServiceDataForIngesters(req, res, next);
  }
  let timeout = setTimeout(() => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
    wlogger.error("No response received from Service while creating a Metadatastore. " + localService.service_url); 
    wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
  }, requestTimeout);
	try {
    const url = (new URL(localService.service_admin_url + "/metadatastores/solr")); 
    const serviceToken = await service_token.getServiceToken(localService);
    wlogger.info("Creating metadatastore on url: " + url);
    wlogger.debug(JSON.stringify(req.body, null, 2));
    response = await axios({
      method: 'post',
      url: url.href,
      data: req.body,
      headers: {
        'Authorization': 'Bearer '+ serviceToken.access_token,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    })
    clearTimeout(timeout);
    return res.status(response.status).json(response.message);
  } catch (err) {
    clearTimeout(timeout);  
		if (axios.isCancel(err) || err.name === 'CanceledError') {
      return;
    }
    wlogger.error("Error from Service " + localService.service_admin_url + "while creating metadatastore " + req.body.name); 
		wlogger.error("ERROR creating metadatastore: " + err);
		return res.status(err.response?.status || 500).json(err);
	}
}

//Create Producer:
exports.createProducer = async (req, res, next) => {
  let response;
  let requestTimeout = (conf.getConfig().requestTimeout) ? conf.getConfig().requestTimeout : 30000;
  const controller = new AbortController();
  if (!localService) {
    await this.getServiceDataForIngesters(req, res, next);
  }
  let timeout = setTimeout(() => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
    wlogger.error("No response received from Service while creating a Producer. " + localService.service_url); 
    wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
  }, requestTimeout);
	try {
    const url = (new URL(localService.service_admin_url + "/producers")); 
    const serviceToken = await service_token.getServiceToken(localService);
    wlogger.info("Creating producer on url: " + url);
    wlogger.debug(JSON.stringify(req.body, null, 2));
    response = await axios({
      method: 'post',
      url: url.href,
      data: req.body,
      headers: {
        'Authorization': 'Bearer '+ serviceToken.access_token,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    })
    clearTimeout(timeout);
    return res.status(response.status).json(response.data);
  } catch (err) {
    clearTimeout(timeout);  
		if (axios.isCancel(err) || err.name === 'CanceledError') {
      return;
    }
    wlogger.error("Error from Service " + localService.service_admin_url + "while creating producer " + req.body.name); 
		wlogger.error("ERROR creating producer: " + err);
		return res.status(err.response?.status || 500).json(err);
	}
}

//Create Consumer:
exports.createConsumer = async (req, res, next) => {
  let response;
  let requestTimeout = (conf.getConfig().requestTimeout) ? conf.getConfig().requestTimeout : 30000;
  const controller = new AbortController();
  if (!localService) {
    await this.getServiceDataForIngesters(req, res, next);
  }
  let timeout = setTimeout(() => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
    wlogger.error("No response received from Service while creating a Consumer. " + localService.service_url); 
    wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
  }, requestTimeout);
	try {
    const url = (new URL(localService.service_admin_url + "/consumers")); 
    const serviceToken = await service_token.getServiceToken(localService);
    wlogger.info("Creating consumer on url: " + url);
    wlogger.debug(JSON.stringify(req.body, null, 2));
    response = await axios({
      method: 'post',
      url: url.href,
      data: req.body,
      headers: {
        'Authorization': 'Bearer '+ serviceToken.access_token,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    })       
    return res.status(response.status).json(response.data);
  } catch (err) {
    clearTimeout(timeout);  
		if (axios.isCancel(err) || err.name === 'CanceledError') {
      return;
    }
    wlogger.error("Error from Service " + localService.service_admin_url + "while creating consumer " + req.body.name); 
		wlogger.error("ERROR creating consumer: " + err);
		return res.status(err.response?.status || 500).json(err);
	}
}

//Create Credentials:
exports.createCredentials = async (req, res, next) => {
  let response;
  let requestTimeout = (conf.getConfig().requestTimeout) ? conf.getConfig().requestTimeout : 30000;
  const controller = new AbortController();
  if (!localService) {
    await this.getServiceDataForIngesters(req, res, next);
  }
  let timeout = setTimeout(() => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
    wlogger.error("No response received from Service while creating credentials. " + localService.service_url); 
    wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
  }, requestTimeout);
	try {
    const credentialsTypeUrl = conf.getConfig().ingesters.credentials.typeList.find(typeEl => typeEl.type === req.body.type).url;
    const url = (new URL(localService.service_admin_url + "/" + credentialsTypeUrl));
    const serviceToken = await service_token.getServiceToken(localService);
    wlogger.info("Creating credentials on url: " + url);
    wlogger.debug(JSON.stringify(req.body.ingesterElement, null, 2));
    response = await axios({
      method: 'post',
      url: url.href,
      data: req.body.ingesterElement,
      headers: {
        'Authorization': 'Bearer '+ serviceToken.access_token,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    })
       
    return res.status(response.status).json(response.data);
  } catch (err) {
    clearTimeout(timeout);  
		if (axios.isCancel(err) || err.name === 'CanceledError') {
      return;
    }
    wlogger.error("Error from Service " + localService.service_admin_url + "while creating credentials " + req.body.name); 
		wlogger.error("ERROR creating credentials: " + err);
		return res.status(err.response?.status || 500).json(err);
	}
}


// DELETE
//Delete Datastore:
exports.deleteDatastore = async (req, res, next) => {
  let response;
  let requestTimeout = (conf.getConfig().requestTimeout) ? conf.getConfig().requestTimeout : 30000;
  const controller = new AbortController();
  if (!localService) {
    await this.getServiceDataForIngesters(req, res, next);
  }
  let timeout = setTimeout(() => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
    wlogger.error("No response received from Service while deleting a Datastore. " + localService.service_url); 
    wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
  }, requestTimeout);
	try {
    const dsPath = conf.getConfig().ingesters.datastores.typeList.find(typeEl => typeEl.type === req.body.type).url;
    const url = (new URL(localService.service_admin_url + "/datastores/" + dsPath + "/" + req.body.name)); 
    const serviceToken = await service_token.getServiceToken(localService);
    wlogger.info("Deleting datastore on url: " + url);
    response = await axios({
      method: 'delete',
      url: url.href,
      headers: {
        'Authorization': 'Bearer '+ serviceToken.access_token,
      },
      signal: controller.signal
    })
    clearTimeout(timeout);
    return res.status(response.status).json(response.message);
  } catch (err) {
    clearTimeout(timeout);  
		if (axios.isCancel(err) || err.name === 'CanceledError') {
      return;
    }
    wlogger.error("Error from Service " + localService.service_admin_url + "while deleting datastore " + req.body.name); 
		wlogger.error("ERROR daleting datastore: " + err);
		return res.status(err.response?.status || 500).json(err);
	}
}

//Delete Metadatastore:
exports.deleteMetadatastore = async (req, res, next) => {
  let response;
  let requestTimeout = (conf.getConfig().requestTimeout) ? conf.getConfig().requestTimeout : 30000;
  const controller = new AbortController();
  if (!localService) {
    await this.getServiceDataForIngesters(req, res, next);
  }
  let timeout = setTimeout(() => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
    wlogger.error("No response received from Service while deleting a Metadatastore. " + localService.service_url); 
    wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
  }, requestTimeout);
	try {
    const url = (new URL(localService.service_admin_url + "/metadatastores/solr/" + req.body.name)); 
    const serviceToken = await service_token.getServiceToken(localService);
    wlogger.info("Deleting metadatastore on url: " + url);
    response = await axios({
      method: 'delete',
      url: url.href,
      headers: {
        'Authorization': 'Bearer '+ serviceToken.access_token,
      },
      signal: controller.signal
    })
    clearTimeout(timeout);
    return res.status(response.status).json(response.message);
  } catch (err) {
    clearTimeout(timeout);  
		if (axios.isCancel(err) || err.name === 'CanceledError') {
      return;
    }
    wlogger.error("Error from Service " + localService.service_admin_url + "while deleting metadatastore " + req.body.name); 
		wlogger.error("ERROR deleting metadatastore: " + err);
		return res.status(err.response?.status || 500).json(err);
	}
}

//Delete Producer:
exports.deleteProducer = async (req, res, next) => {
  let response;
  let requestTimeout = (conf.getConfig().requestTimeout) ? conf.getConfig().requestTimeout : 30000;
  const controller = new AbortController();
  if (!localService) {
    await this.getServiceDataForIngesters(req, res, next);
  }
  let timeout = setTimeout(() => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
    wlogger.error("No response received from Service while deleting a Producer. " + localService.service_url); 
    wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
  }, requestTimeout);
	try {
    const url = (new URL(localService.service_admin_url + "/producers/" + req.body.name)); 
    const serviceToken = await service_token.getServiceToken(localService);
    wlogger.info("Deleting producer on url: " + url);
    response = await axios({
      method: 'delete',
      url: url.href,
      headers: {
        'Authorization': 'Bearer '+ serviceToken.access_token,
      },
      signal: controller.signal
    })
    clearTimeout(timeout);
    return res.status(response.status).json(response.message);
  } catch (err) {
    clearTimeout(timeout);  
		if (axios.isCancel(err) || err.name === 'CanceledError') {
      return;
    }
    wlogger.error("Error from Service " + localService.service_admin_url + "while deleting producer " + req.body.name); 
		wlogger.error("ERROR deleting producer: " + err);
		return res.status(err.response?.status || 500).json(err);
	}
}

//Delete Consumer:
exports.deleteConsumer = async (req, res, next) => {
  let response;
  let requestTimeout = (conf.getConfig().requestTimeout) ? conf.getConfig().requestTimeout : 30000;
  const controller = new AbortController();
  if (!localService) {
    await this.getServiceDataForIngesters(req, res, next);
  }
  let timeout = setTimeout(() => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
    wlogger.error("No response received from Service while deleting a Consumer. " + localService.service_url); 
    wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
  }, requestTimeout);
	try {
    const url = (new URL(localService.service_admin_url + "/consumers/" + req.body.name)); 
    const serviceToken = await service_token.getServiceToken(localService);
    wlogger.info("Deleting consumer on url: " + url);
    response = await axios({
      method: 'delete',
      url: url.href,
      headers: {
        'Authorization': 'Bearer '+ serviceToken.access_token,
      },
      signal: controller.signal
    })
    clearTimeout(timeout);
    return res.status(response.status).json(response.message);
  } catch (err) {
    clearTimeout(timeout);  
		if (axios.isCancel(err) || err.name === 'CanceledError') {
      return;
    }
    wlogger.error("Error from Service " + localService.service_admin_url + "while deleting consumer " + req.body.name); 
		wlogger.error("ERROR deleting consumer: " + err);
		return res.status(err.response?.status || 500).json(err);
	}
}

//Delete Credentials:
exports.deleteCredentials = async (req, res, next) => {
  let response;
  let requestTimeout = (conf.getConfig().requestTimeout) ? conf.getConfig().requestTimeout : 30000;
  const controller = new AbortController();
  if (!localService) {
    await this.getServiceDataForIngesters(req, res, next);
  }
  let timeout = setTimeout(() => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
    wlogger.error("No response received from Service while deleting a Credentials. " + localService.service_url); 
    wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
  }, requestTimeout);
	try {
    const credentialsTypeUrl = conf.getConfig().ingesters.credentials.typeList.find(typeEl => typeEl.type === req.body.type).url;
    const url = (new URL(localService.service_admin_url + "/" + credentialsTypeUrl + "/" + req.body.name)); 
    const serviceToken = await service_token.getServiceToken(localService);
    wlogger.info("Deleting credentials on url: " + url);
    response = await axios({
      method: 'delete',
      url: url.href,
      headers: {
        'Authorization': 'Bearer '+ serviceToken.access_token,
      },
      signal: controller.signal
    })
    clearTimeout(timeout);
    return res.status(response.status).json(response.message);
  } catch (err) {
    clearTimeout(timeout);  
		if (axios.isCancel(err) || err.name === 'CanceledError') {
      return;
    }
    wlogger.error("Error from Service " + localService.service_admin_url + "while deleting credentials " + req.body.name); 
		wlogger.error("ERROR deleting credentials: " + err);
		return res.status(err.response?.status || 500).json(err);
	}
}


//Patch Producer:
exports.patchProducer = async (req, res, next) => {
  let response;
  let requestTimeout = (conf.getConfig().requestTimeout) ? conf.getConfig().requestTimeout : 30000;
  const controller = new AbortController();
  if (!localService) {
    await this.getServiceDataForIngesters(req, res, next);
  }
  let timeout = setTimeout(() => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
    wlogger.error("No response received from Service while patching a Producer. " + localService.service_url); 
    wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
  }, requestTimeout);
	try {
    const url = new URL(localService.service_admin_url + "/producers/" + req.body.ingesterElement.name);
    const serviceToken = await service_token.getServiceToken(localService);
    url.searchParams.set("restartIngesters", String(req.body.restart));
    wlogger.info("Patching producer on url: " + url);
    wlogger.debug("Patching producer with body: " + JSON.stringify(req.body.ingesterElement, null, 2));
    response = await axios({
      method: 'patch',
      url: url.href,
      data: req.body.ingesterElement,
      headers: {
        'Authorization': 'Bearer '+ serviceToken.access_token,
      },
      signal: controller.signal
    })
    clearTimeout(timeout);
    return res.status(response.status).json(response.message);
  } catch (err) {
    clearTimeout(timeout);  
		if (axios.isCancel(err) || err.name === 'CanceledError') {
      return;
    }
    wlogger.error("Error from Service " + localService.service_admin_url + " while patching producer: " + req.body.ingesterElement.name); 
		wlogger.error("ERROR patching producer: " + err);
		return res.status(err.response?.status || 500).json(err);
	}
}

//Patch Consumer:
exports.patchConsumer = async (req, res, next) => {
  let response;
  let requestTimeout = (conf.getConfig().requestTimeout) ? conf.getConfig().requestTimeout : 30000;
  const controller = new AbortController();
  if (!localService) {
    await this.getServiceDataForIngesters(req, res, next);
  }
  let timeout = setTimeout(() => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
    wlogger.error("No response received from Service while patching a Consumer. " + localService.service_url); 
    wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
  }, requestTimeout);
	try {
    const url = new URL(localService.service_admin_url + "/consumers/" + req.body.ingesterElement.name);
    const serviceToken = await service_token.getServiceToken(localService);
    url.searchParams.set("restartIngesters", String(req.body.restart));
    wlogger.info("Patching consumer on url: " + url);
    wlogger.debug("Patching consumer with body: " + JSON.stringify(req.body.ingesterElement, null, 2));
    response = await axios({
      method: 'patch',
      url: url.href,
      data: req.body.ingesterElement,
      headers: {
        'Authorization': 'Bearer '+ serviceToken.access_token,
      },
      signal: controller.signal
    })
    clearTimeout(timeout);
    return res.status(response.status).json(response.message);
  } catch (err) {
    clearTimeout(timeout);  
		if (axios.isCancel(err) || err.name === 'CanceledError') {
      return;
    }
    wlogger.error("Error from Service " + localService.service_admin_url + " while patching consumer: " + req.body.ingesterElement.name); 
		wlogger.error("ERROR patching consumer: " + err);
		return res.status(err.response?.status || 500).json(err);
	}
}

//Patch Datastore:
exports.patchDatastore = async (req, res, next) => {
  let response;
  let requestTimeout = (conf.getConfig().requestTimeout) ? conf.getConfig().requestTimeout : 30000;
  const controller = new AbortController();
  if (!localService) {
    await this.getServiceDataForIngesters(req, res, next);
  }
  let timeout = setTimeout(() => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
    wlogger.error("No response received from Service while patching a Datastore. " + localService.service_url); 
    wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
  }, requestTimeout);
	try {
    const dsPath = conf.getConfig().ingesters.datastores.typeList.find(typeEl => typeEl.type === req.body.ingesterElement.type).url;
    const url = new URL(localService.service_admin_url + "/datastores/" + dsPath + "/" + req.body.ingesterElement.name);
    const serviceToken = await service_token.getServiceToken(localService);
    url.searchParams.set("restartIngesters", String(req.body.restart));
    wlogger.info("Patching datastore on url: " + url);
    wlogger.debug("Patching datastore with body: " + JSON.stringify(req.body.ingesterElement, null, 2));
    response = await axios({
      method: 'patch',
      url: url.href,
      data: req.body.ingesterElement,
      headers: {
        'Authorization': 'Bearer '+ serviceToken.access_token,
      },
      signal: controller.signal
    })
    clearTimeout(timeout);
    return res.status(response.status).json(response.message);
  } catch (err) {
    clearTimeout(timeout);  
		if (axios.isCancel(err) || err.name === 'CanceledError') {
      return;
    }
    wlogger.error("Error from Service " + localService.service_admin_url + " while patching datastore: " + req.body.ingesterElement.name); 
		wlogger.error("ERROR patching datastore: " + err);
		return res.status(err.response?.status || 500).json(err);
	}
}

//Patch Metadatastore:
exports.patchMetadatastore = async (req, res, next) => {
  let response;
  let requestTimeout = (conf.getConfig().requestTimeout) ? conf.getConfig().requestTimeout : 30000;
  const controller = new AbortController();
  if (!localService) {
    await this.getServiceDataForIngesters(req, res, next);
  }
  let timeout = setTimeout(() => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
    wlogger.error("No response received from Service while patching a Metadatastore. " + localService.service_url); 
    wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
  }, requestTimeout);
	try {
    const url = new URL(localService.service_admin_url + "/metadatastores/solr/" + req.body.ingesterElement.name);
    const serviceToken = await service_token.getServiceToken(localService);
    url.searchParams.set("restartIngesters", String(req.body.restart));
    wlogger.info("Patching metadatastore on url: " + url);
    wlogger.debug("Patching metadatastore with body: " + JSON.stringify(req.body.ingesterElement, null, 2));
    response = await axios({
      method: 'patch',
      url: url.href,
      data: req.body.ingesterElement,
      headers: {
        'Authorization': 'Bearer '+ serviceToken.access_token,
      },
      signal: controller.signal
    })
    clearTimeout(timeout);
    return res.status(response.status).json(response.message);
  } catch (err) {
    clearTimeout(timeout);  
		if (axios.isCancel(err) || err.name === 'CanceledError') {
      return;
    }
    wlogger.error("Error from Service " + localService.service_admin_url + " while patching metadatastore: " + req.body.ingesterElement.name); 
		wlogger.error("ERROR patching metadatastore: " + err);
		return res.status(err.response?.status || 500).json(err);
	}
}

//Patch Credential:
exports.patchCredential = async (req, res, next) => {
  let response;
  let requestTimeout = (conf.getConfig().requestTimeout) ? conf.getConfig().requestTimeout : 30000;
  const controller = new AbortController();
  if (!localService) {
    await this.getServiceDataForIngesters(req, res, next);
  }
  let timeout = setTimeout(() => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
    wlogger.error("No response received from Service while patching a Credential. " + localService.service_url); 
    wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
  }, requestTimeout);
	try {
    const credentialsTypeUrl = conf.getConfig().ingesters.credentials.typeList.find(typeEl => typeEl.type === req.body.type).url;
    const url = (new URL(localService.service_admin_url + "/" + credentialsTypeUrl + "/" + req.body.ingesterElement.name));
    const serviceToken = await service_token.getServiceToken(localService);
    wlogger.info("Patching credential on url: " + url);
    wlogger.debug("Patching credential with body: " + JSON.stringify(req.body.ingesterElement, null, 2));
    response = await axios({
      method: 'patch',
      url: url.href,
      data: req.body.ingesterElement,
      headers: {
        'Authorization': 'Bearer '+ serviceToken.access_token,
      },
      signal: controller.signal
    })
    clearTimeout(timeout);
    return res.status(response.status).json(response.message);
  } catch (err) {
    clearTimeout(timeout);  
		if (axios.isCancel(err) || err.name === 'CanceledError') {
      return;
    }
    wlogger.error("Error from Service " + localService.service_admin_url + " while patching credential: " + req.body.ingesterElement.name); 
		wlogger.error("ERROR patching credential: " + err);
		return res.status(err.response?.status || 500).json(err);
	}
}



//START & STOP Ingester:
exports.manageIngester = async (req, res, next) => {
  let response;
  let requestTimeout = (conf.getConfig().requestTimeout) ? conf.getConfig().requestTimeout : 30000;
  const controller = new AbortController();
  if (!localService) {
    await this.getServiceDataForIngesters(req, res, next);
  }
  let timeout = setTimeout(() => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
    wlogger.error("No response received from Service while managing an Ingester. " + localService.service_url); 
    wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
  }, requestTimeout);
	try {
    const url = new URL(localService.service_admin_url + "/ingesters-management/" + req.body.name);
    const serviceToken = await service_token.getServiceToken(localService);
    url.searchParams.set("action", String(req.body.action));
    wlogger.info("Managing ingester on url: " + url);
    wlogger.debug(JSON.stringify(req.body, null, 2));
    response = await axios({
      method: 'post',
      url: url.href,
      headers: {
        'Authorization': 'Bearer '+ serviceToken.access_token
      },
      signal: controller.signal
    })
    clearTimeout(timeout);
    return res.status(response.status).json(response.data);
  } catch (err) {
    clearTimeout(timeout);  
		if (axios.isCancel(err) || err.name === 'CanceledError') {
      return;
    }
    wlogger.error("Error from Service " + localService.service_admin_url + " while managing ingester: " + req.body.name); 
		wlogger.error("ERROR managing ingester: " + err);
		return res.status(err.response?.status || 500).json(err);
	}
}