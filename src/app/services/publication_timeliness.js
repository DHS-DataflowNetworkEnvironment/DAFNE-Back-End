//Models imports
const Sequelize = require('sequelize');
const cron = require('node-cron');
const moment = require('moment');
const Centre = require("app/models/centre");
const Service = require("app/models/service");
const PublicationTimeliness = require("app/models/publication_timeliness");
const utility = require('app/util/utility');
const wlogger = require('app/util/wlogger');
const conf = require('app/util/config');
const ingestersController = require('app/controllers/ingesters');

let job;
let purgeJob;
let feRetryJob;
// default check publication timeliness schedule 10 minutes
let schedule = "0 * * * *";
// default purge publication timeliness  table, evry day at 01:00 AM
let purgeSchedule = "0 1 * * *";
// default publication timeliness  rolling period 90 days
let rollingPeriodInDays = 90;
let enablePurge = true;

const productSourcesUrl = '/ProductSources';
const searchProductByFilter = '/Products?$filter=:filter&$orderby=PublicationDate desc&$top=1';
const searchProductOnService = "/Products?$filter=Name eq ':name'&$top=1";


getSourceService = async(url) => {
    let sourceService;
    let sourceUrl = url;
    if (sourceUrl.lastIndexOf('/') == sourceUrl.length -1) {
        sourceUrl = sourceUrl.slice(0, -1);
    }
    
    try {
        // Find service without '/' in the end 
        sourceService = await Service.findOne({
            where: {
                service_url:  sourceUrl 
            }
        });
        // Try finding service with '/' in the end if not found at first attempt
        if(!sourceService) {
            sourceService = await Service.findOne({
                where: {
                    service_url: sourceUrl + '/'
                }
            });
        }
    } catch (error) {
        wlogger.error(`Error searching sourceUrl ${sourceUrl} in the DAFNE DB `);
        wlogger.error(error);
    }
    return sourceService;
}

/*
   Method used to compute timeliness checking data retrieved from local service and Referenced Data Source
   Input parameters are:
   sourceProduct:       List of Products retrieved from the local BE with a given CreationDate interval
   producer:            Producer information
   sourceService:       DAFNE service corresponding to the ingester data source
   localService:        Local GSS Service
   lastPublicationDate: Last Publication Date retrieved from latest ingested product
   localCentre:         DAFNE local centre
   currentTimestamp:    Measure timestamp
   
 */
manageTimeliness = async (sourceProduct, producer, sourceService, localService, lastPublicationDate, localCentre, currentTimestamp) => {
  wlogger.debug("MTL - Managing timeliness for source products.");
  try {
    let description;
    if(sourceProduct && lastPublicationDate) {
      const sourceProductPublicationDate = moment(sourceProduct.PublicationDate).utc().format('YYYY-MM-DDTHH:mm:ss.SSS')+'Z';
      wlogger.info(`Found product ${sourceProduct.Name} - ${sourceProduct.Id} on Reference Source ${sourceService.service_url} with PublicationDate ${sourceProductPublicationDate}.`);
      const timeliness = new Date(lastPublicationDate) - new Date(sourceProductPublicationDate);
      description = `Found product ${sourceProduct.Name} on reference source ${sourceService.service_url} with PublicationDate ${sourceProductPublicationDate}`;
      const publication_timeliness = await PublicationTimeliness.create({
          timestamp: currentTimestamp,
          centre_id: localCentre.id,
          local_url: localService.service_url,
          filter_label: producer.name,
          filter: producer.source.filter,
          source_url: sourceService.service_url,
          product_name: sourceProduct.Name,
          product_id: sourceProduct.Id,
          publication_date_local: lastPublicationDate,
          publication_date_source: sourceProductPublicationDate,
          timeliness: timeliness,
          description: description
      });
      wlogger.info(`Added new publication timeliness measure with values: timestamp - ${currentTimestamp}, centre_id - ${localCentre.id}, local_url - ${localService.service_url}, 
        filter_label - ${producer.name}, filter - ${producer.source.filter}, source_url - ${sourceService.service_url}, product_name - ${sourceProduct.Name}, 
        product_id - ${sourceProduct.Id}, publication_date_local - ${lastPublicationDate}, publication_date_source - ${sourceProductPublicationDate}, timeliness - ${timeliness}`);                                                             
    } else {
      wlogger.warn(`No products found on reference source ${sourceService.service_url} searching product name N/D. Publication Timeliness cannot be computed`);
      description = `No products found on reference source ${sourceService.service_url} related to Producer ${producer.name}, searching product name N/D`;
      const publication_timeliness = await PublicationTimeliness.create({
        timestamp: currentTimestamp,
        centre_id: localCentre.id,
        local_url: localService.service_url,
        filter_label: producer.name,
        filter: producer.source.filter,
        source_url: sourceService.service_url,
        description: description
      });
      wlogger.info(`Added new publication timeliness measure with values: timestamp - ${currentTimestamp}, centre_id - ${localCentre.id}, local_url - ${localService.service_url},
      filter_label - ${producer.name}, filter - ${producer.source.filter}, source_url - ${sourceService.service_url}, 
      description - ${description}`);
    }
  } catch (err) {
    wlogger.error(`Error while computing Publication Timeliness on reference source ${sourceService.service_url} related to Producer ${producer.name}, searching product name ${sourceProduct.Name ? sourceProduct.Name : 'N/D'}`)
    wlogger.error(err);
  }
}


const sameDay = (date1, date2) => {
  return date1.toISOString().split('T')[0] === date2.toISOString().split('T')[0];
};

checkPublicationTimeliness = async () => {
	let status = 0;    
	try {
    let timelinessTolerance = (conf.getConfig().timeliness && conf.getConfig().timeliness.tolerance) ? conf.getConfig().timeliness.tolerance : 1;
		const localCentre = await Centre.findOne({
			where: {
				local: true
			}
		});
    const localService = await Service.findOne({
			where: {
				centre: localCentre.id,
				service_type: 8  //Take only one GSS service.
			}
		});
   
		const currentTimestamp = new Date().getTime();
    if(!localService) {
      wlogger.error("No suitable service found for centre " + localCentre.id + ". Cannot check local publication timeliness at " + currentTimestamp);
    }

    let timelinessToBeCalculated = [];
    // New algorythm with ingesters
    /*
        1. Identification of the consumers and ingesters configured for the local centre.
        2. Identification of the filters used for the found ingesters. 
        3. Identification of the last published product for that filter in the local Service
        4. Identification of the last ingested product for that filter in the DataSource
        5. Publication Timeliness computation as difference between the CreationDate of DataSource and local Service
    */

    // Get all producers referred to the local centre:
    const req = {
      params: {},
      query: {},
      body: {},
      headers: {},
      user: {}
    };

    const next = (err) => {
      if (err) {
        throw err;
      }
    };
    const producersResponse = {
      status: () => ({
        json: (payload) => payload
      })
    };
    const allProducers = await ingestersController.getAllProducers(req, producersResponse, next);
    // Get all consumers referred to the local centre:
    const consumersResponse = {
      status: () => ({
        json: (payload) => payload
      })
    };
    const allConsumers = await ingestersController.getAllConsumers(req, consumersResponse, next);
    const consumersNamesArray = allConsumers.map((consumer) => consumer.name);
    // Get all ingesters referred to the local centre:
    const ingestersResponse = {
      status: () => ({
        json: (payload) => payload
      })
    };
    const allIngesters = await ingestersController.getAllIngesters(req, ingestersResponse, next);

    if (allIngesters && allIngesters.length > 0) {
      // Find local ingesters instances
      const localInstances = allIngesters.filter(instance => consumersNamesArray.includes(instance.name));
      for (const instance of localInstances) {
        if (instance.events && instance.events.length > 0) {
          // There are ingested products for this consumer.
          const consumer = allConsumers.find((c) => c.name === instance.name);
          // Take all producers with the same topic.
          const producers = allProducers.filter((p) => consumer.topics.includes(p.topic));
          for (const producer of producers) {
            // Loop and Retrieve the source service for each producer
            const sourceService = await getSourceService(producer.source.serviceRootUrl);
            if(!sourceService) {
                wlogger.warn(`The Data Source ${producer.source.serviceRootUrl} is not configured among DAFNE services. Cannot compute the publication timeliness, 
                reference source data are missing`);
            } else {
              // Get the latest event for the looped instance, limited to today date
              wlogger.debug("Filtering events for today's date.");
              const mostRecentIngested = instance.events.filter((e) => (e.status ? e.status === "INGESTED" : false) && sameDay(new Date(e.publicationDate), new Date()));
              wlogger.debug("Most recent ingested events found: " + mostRecentIngested.length);
              let mostRecentEvent = null;
              if (mostRecentIngested.length > 0) {
                mostRecentEvent = mostRecentIngested
                    .reduce((latest, current) => {
                      if (!latest) return current;
                      return new Date(current.eventDate) > new Date(latest.eventDate) ? current : latest;
                    }, null);
              }

              if (mostRecentEvent) {
                wlogger.debug("An event on today's date has been found. Calculating timeliness.");
                let requestFilter;
                // Retrieve product lastPublicationDate
                const lastPublicationDate = moment(mostRecentEvent.publicationDate).utc().format('YYYY-MM-DDTHH:mm:ss.SSS')+'Z';
                let productUrlByFilterParam = searchProductByFilter;

                // Search the same product name on the datasource
                const productName = mostRecentEvent.productName.substring(0, mostRecentEvent.productName.lastIndexOf('.'));
                if (!productName) {
                  wlogger.error("Failed to extract product name from event");
                  return;
                }
                requestFilter = `startswith(Name, '${productName}')`;
                productUrlByFilterParam = productUrlByFilterParam.replace(':filter',requestFilter);
                const sourceProducts = await utility.performDHuSServiceRequest(sourceService, productUrlByFilterParam);
                let sourceProduct = null;
                if (!sourceProducts || !sourceProducts.value || sourceProducts.value.length === 0) {
                  wlogger.error("There was an error while fetching products from the referenced source: " + producer.source.serviceRootUrl);
                } else {
                  sourceProduct = sourceProducts.value[0];
                }
                await manageTimeliness(sourceProduct, producer, sourceService, localService, lastPublicationDate, localCentre, currentTimestamp);
              } else {
                wlogger.info("No recent event found for producer: " + producer.source.serviceRootUrl);
                await manageTimeliness(null, producer, sourceService, localService, null, localCentre, currentTimestamp);
              }
            }
          }
        }
      }
    }
	} catch (error) {
		wlogger.error("Checking publication timeliness: " + error);		
	}
  return status;
};

purgePublicationTimeliness = async() => {
    try {
        if(conf.getConfig().timeliness && conf.getConfig().timeliness.rollingPeriodInDays ) {
            if (isNaN(conf.getConfig().timeliness.rollingPeriodInDays)) {
                wlogger.warn(`The parameter timeliness.rollingPeriodInDay must be a number. Found value: ${conf.getConfig().timeliness.rollingPeriodInDays}`);
                wlogger.warn(`Using default: ${rollingPeriodInDays}`);
            } else {
                rollingPeriodInDays = conf.getConfig().timeliness.rollingPeriodInDays;
            }
        }
        var rollingDate = new Date();
        rollingDate.setDate(rollingDate.getDate()-rollingPeriodInDays);
        wlogger.info(`Start purging publication timeliness data older than ${rollingPeriodInDays}. Check date is ${rollingDate}`);
        const purgedRows = await PublicationTimeliness.destroy({
            where: { timestamp: {[Sequelize.Op.lt]: rollingDate} } 
        });
        wlogger.info(`Successfully purged ${purgedRows} rows in publication timeliness`);
    } catch (error) {
        wlogger.error("Errors occurred while purging publication timeliness");
        wlogger.error(error);
    }
}


exports.createScheduler = () => {
    try {
        if(conf.getConfig().timeliness && conf.getConfig().timeliness.schedule && conf.getConfig().timeliness.schedule !== '') {
            schedule = conf.getConfig().timeliness.schedule;
            wlogger.info("[Publication Timeliness] Use configuration file scheduler: " + schedule);
        } else {
            wlogger.info("[Publication Timeliness] No scheduler defined in configuration file for publication timeliness. Using default scheduler: " + schedule);
        }
        job = cron.schedule(schedule, async() => {
            wlogger.info("Start verifying publication timeliness...");
            const status = await checkPublicationTimeliness();           
        })
    } catch(error) {
        wlogger.error("Error occurred while creating scheduler for publication timeliness")
		wlogger.error(error);
	}
};

exports.checkAndUpdateScheduler = () => {
    try {
        wlogger.debug("[Publication Timeliness] Check configured schedule");
        let newPeriod = (conf.getConfig().timeliness && conf.getConfig().timeliness.schedule) ? conf.getConfig().timeliness.schedule : null;
        if(newPeriod && newPeriod != schedule ) {
            wlogger.info("[Publication Timeliness] Reschedule job, found new scheduling period: " + newPeriod);
            schedule = newPeriod;
            if (job) {
                wlogger.info("Found not null job");	
                job.stop();
                
                job = cron.schedule(schedule, async() => {
                    wlogger.info("Start verifying publication timeliness...");
                    const status = await checkPublicationTimeliness();      
                })

            } else {
                wlogger.info("No jobs found");
            }
        }
    } catch(error) {
        wlogger.error("Error occurred while updating scheduler for publication timeliness")
        wlogger.error(error);
    }
};

exports.createPurgeScheduler = () => {
    try {
        if(conf.getConfig().timeliness && conf.getConfig().timeliness.hasOwnProperty('enablePurge')) {
            enablePurge = conf.getConfig().timeliness.enablePurge;
        }
        if(enablePurge) {
            if(conf.getConfig().timeliness && conf.getConfig().timeliness.purgeSchedule && conf.getConfig().timeliness.purgeSchedule !== '') {
                purgeSchedule = conf.getConfig().timeliness.purgeSchedule;
                wlogger.info("[Publication Timeliness] Use configuration file purgeSchedule: " + purgeSchedule);
            } else {
                wlogger.info("[Publication Timeliness] No purgeSchedule defined in configuration file for publication timeliness. Using default purgeSchedule: " + purgeSchedule);
            }
            purgeJob = cron.schedule(purgeSchedule, async() => {
                wlogger.info("Start purging publication timeliness...");
                await purgePublicationTimeliness();           
            })
        } else {
            wlogger.info("Publication timeliness purge is disabled. Please check your parameters if you want to enable it.");
        }
    } catch(error) {
        wlogger.error("Error occurred while creating purgeSchedule for publication timeliness")
		wlogger.error(error);
	}
};