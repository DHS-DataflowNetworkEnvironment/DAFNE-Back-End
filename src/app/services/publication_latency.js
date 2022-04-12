//Models imports
const Centre = require("../models/centre");
const Service = require("../models/service");
const PublicationLatency = require("../models/publication_latency");
const Sequelize = require('sequelize');
const utility = require('../util/utility');
const wlogger = require('../util/wlogger');
const conf = require('../util/config');
const  cron = require('node-cron');
const moment = require('moment');

let job;
let purgeJob;
let feRetryJob;
// default check publication latency schedule 10 minutes
let schedule = "0 * * * *";
// default purge publication latency  table, evry day at 01:00 AM
let purgeSchedule = "0 1 * * *";
// default publication latency  rolling period 90 days
let rollingPeriodInDays = 90;
let enablePurge = true;

// default check Front-End publication latency schedule 5 minutes
let feRetrySchedule = "*/5 * * * *";
// default Front-End publication latency number of retries
let feMaxRetry = 10;

const synchUrl = 'odata/v1/Synchronizers';
const productSourcesUrl = 'odata/v2/ProductSources';
const intelliSynchUrl = 'odata/v2/Synchronizers?$expand=ReferencedSources';
const searchProductByFilter = 'odata/v1/Products?$filter=:filter&$orderby=CreationDate desc&$top=1';
const searchProductOnService = "odata/v2/Products?$filter=Name eq ':name'&$top=1";


getSourceService = async(sourceUrl) => {
    let sourceService;
    try {
        sourceService = await Service.findOne({
            where: {
                service_url: {
                    [Sequelize.Op.like]: sourceUrl + '%'
                }
            }
        });
    } catch (error) {
        wlogger.error(`Error searching sourceUrl ${sourceUrl} in the DAFNE DB `);
        wlogger.error(error);
    }
    return sourceService;

}

/*
   Method used to compute latency checking data retrieved from local BE, FE and Referenced Data Source
   Input parameters are:
   beProducts:          List of Products retrieved from the local BE with a given CreationDate interval
   sourceUrl:           DataSource service URL
   sourceService:       DAFNE service corresponding to the synch data source
   service:             Local BE Service
   feService:           Local FE Service
   frontEndUrl:         Service URL of the local FE
   lastCreationDate:    Last Creation DAte retrieved from related sync
   element:             Synchronizer
   centre:              DAFNE local centre
   productUrlByDate:    odata v2 Products filter used to retrieve products on local BE
   currentTimestamp:    Measure timestamp
   
 */
manageLatency = async (beProducts, sourceUrl, sourceService, service, feService, frontEndUrl, lastCreationDate, element, centre, productUrlByDate, currentTimestamp) => {
    
    try {
        if(beProducts && beProducts.status == 200 && beProducts.data && beProducts.data.d.results && beProducts.data.d.results.length > 0) {                                        
            const beProduct =  beProducts.data.d.results[0];
            const beProductCreationDate = moment(beProduct.CreationDate).utc().format('YYYY-MM-DDTHH:mm:ss.SSS')+'Z';
            wlogger.info(`Found product ${beProduct.Name} - ${beProduct.Id} on local BE Service  ${service.service_url} with CreationDate 
            ${beProductCreationDate}. Searching product on source ${sourceUrl}`);
            //retrieve product on source
            wlogger.info(`Finding Product ${beProduct.Name} on the referenced source ${sourceUrl} `);
            let searchProductOnFeAndSource = searchProductOnService;
            searchProductOnFeAndSource = searchProductOnFeAndSource.replace(':name',beProduct.Name);
            const sourceProducts = await utility.performDHuSServiceRequest(sourceService, searchProductOnFeAndSource);
            let feProduct;
            let sourceProduct;
            let description;
            if(sourceProducts && sourceProducts.status == 200 && sourceProducts.data && sourceProducts.data.value && sourceProducts.data.value.length > 0) { 
                sourceProduct =  sourceProducts.data.value[0];
                wlogger.info(`Found product ${sourceProduct.Name} - ${sourceProduct.Id} on Reference Source ${sourceUrl} with CreationDate ${sourceProduct.CreationDate}.`);
                //retrieve product on FE
                if(feService) {
                    
                    const feProducts = await utility.performDHuSServiceRequest(feService, searchProductOnFeAndSource);
                    
                    if(feProducts && feProducts.status == 200 && feProducts.data && feProducts.data.value && feProducts.data.value.length > 0) { 
                        feProduct =  feProducts.data.value[0];
                        wlogger.info(`Found product ${feProduct.Name} - ${feProduct.Id} on local FE Service  ${feService.service_url} with CreationDate ${feProduct.CreationDate}.`);
                    }
                    else {
                        wlogger.warn(`Cannot find product ${beProduct.Name} on local FE first attempt failed`);
                        description = `Cannot find product ${beProduct.Name} on local FE first attempt failed`;
                    }
                } else {
                    wlogger.warn(`Cannot find product ${beProduct.Name} on local FE - No FE Service configured`);
                    description = 'No local FE configured';
                }
               
                const latencyBe =  new Date(beProductCreationDate) - new Date(sourceProduct.CreationDate);
                const latencyFe =  (feProduct) ? (new Date(feProduct.CreationDate) - new Date(sourceProduct.CreationDate)) : null;                                            
                const creationDateFe = (feProduct) ? feProduct.CreationDate : null;
                const publication_latency = await PublicationLatency.create({
                    timestamp: currentTimestamp,
                    backend_url: service.service_url,
                    frontend_url: frontEndUrl,
                    centre_id: centre.id,
                    synch_id: element.Id,
                    synch_label: element.Label,
                    synch_filter: element.FilterParam,
                    synch_geo_filter: element.GeoFilter,
                    source_url: sourceUrl,
                    source_last_creation_date: lastCreationDate,
                    product_name: beProduct.Name,
                    product_id: beProduct.Id,
                    creation_date_be: beProductCreationDate,
                    creation_date_fe: creationDateFe,
                    creation_date_source: sourceProduct.CreationDate,
                    latency_be: latencyBe,
                    latency_fe: latencyFe,
                    description: description
                });
                wlogger.debug(publication_latency);
                wlogger.info(`Added new publication latency measure with values: timestamp - ${currentTimestamp}, backend_url - ${service.service_url}, frontend_url - ${frontEndUrl},
                centre_id - ${centre.id}, synch_id -  ${element.Id}, synch_label - ${element.Label}, synch_filter - ${element.FilterParam}, synch_geo_filter - ${element.GeoFilter}
                source_url - ${sourceUrl}, source_last_creation_date -  ${lastCreationDate}, product_name - ${beProduct.Name}, product_id - ${beProduct.Id}, creation_date_be - ${beProductCreationDate}
                creation_date_fe - ${creationDateFe}, creation_date_source -  ${sourceProduct.CreationDate}, latency_be - ${latencyBe}, latency_fe - ${latencyFe}`);
            }
            else {
                wlogger.warn(`Cannot find product ${beProduct.Name} on Reference Source. Publication Latency cannot be computed`);
                description = `Cannot find product ${beProduct.Name} on Reference Source.`;
                const publication_latency = await PublicationLatency.create({
                    timestamp: currentTimestamp,
                    backend_url: service.service_url,
                    frontend_url: frontEndUrl,
                    centre_id: centre.id,
                    synch_id: element.Id,
                    synch_label: element.Label,
                    synch_filter: element.FilterParam,
                    synch_geo_filter: element.GeoFilter,
                    source_url: sourceUrl,
                    source_last_creation_date: lastCreationDate,
                    product_name: beProduct.Name,
                    product_id: beProduct.Id,
                    creation_date_be: beProductCreationDate,
                    description: description
                });
                wlogger.debug(publication_latency);
                wlogger.info(`Added new publication latency measure with values: timestamp - ${currentTimestamp}, backend_url - ${service.service_url}, frontend_url - ${frontEndUrl},
                centre_id - ${centre.id}, synch_id -  ${element.Id}, synch_label - ${element.Label}, synch_filter - ${element.FilterParam}, synch_geo_filter - ${element.GeoFilter}
                source_url - ${sourceUrl}, source_last_creation_date -  ${lastCreationDate}, product_name - ${beProduct.Name}, product_id - ${beProduct.Id}, creation_date_be - ${beProductCreationDate}, 
                description - ${description}`);
            }                                                                        
        } else {
            wlogger.warn(`No products found on local BE ${service.service_url} performing request ${productUrlByDate}. Publication Latency cannot be computed`);
            description = `No products found on local BE ${service.service_url} performing request ${productUrlByDate}`;
            const publication_latency = await PublicationLatency.create({
                timestamp: currentTimestamp,
                backend_url: service.service_url,
                centre_id: centre.id,
                synch_id: element.Id,
                synch_label: element.Label,
                synch_filter: element.FilterParam,
                synch_geo_filter: element.GeoFilter,
                source_url: sourceUrl,
                source_last_creation_date: lastCreationDate,
                description: description
            });
            wlogger.debug(publication_latency);
            wlogger.info(`Added new publication latency measure with values: timestamp - ${currentTimestamp}, backend_url - ${service.service_url}, centre_id - ${centre.id}, 
            synch_id -  ${element.Id}, synch_label - ${element.Label}, synch_filter - ${element.FilterParam}, synch_geo_filter - ${element.GeoFilter}, source_url - ${sourceUrl}, 
            source_last_creation_date -  ${lastCreationDate}, description - ${description}`);
        }
    } catch (err) {
        wlogger.error(`Error while computing Publication Latency on local BE ${service.service_url} related to Synchronizer ${element.Id} - ${element.Label}`)
        wlogger.error(err);
    }
}




checkPublicationLatency = async () => {
	let status = 0;
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
					[Sequelize.Op.in]: [1, 3]  //Exclude FE services from services
				}
			}
		});
        const feService = await Service.findOne({
			where: {
				centre: centre.id,
				service_type: {
					[Sequelize.Op.in]: [1, 2]  //Exclude BE services from services
				}
			},
            order: [['service_type', 'DESC']] //Order by service_type DESC to get the FE in case an FE + Single Instance configured (not a real case)
		});
        const frontEndUrl = (feService) ? feService.service_url : null;
		let currentTimestamp = new Date().getTime();
        if(services.length === 0) {
            wlogger.error("No suitable service found for centre " + centre.id + ". Cannot check local publication latency at " + currentTimestamp);
        }
        for (const service of services) {
            // check publication latency for local centre
            /*
                1. Identification of synchronizer configured, present on the BEs of the local center.
                2. Identification of the updated CreationDate for that synch. 
                   (In the case of Intelligent Synchronizers the Latest CreationDate configured within the ProductSource associated to the synch)
                3. Identification of the last product synchronized for that filter in the BE instance associated to the local centre
                4. Identification of the same product synchronized for that filter in the FE instance associated to the local centre
                5. Identification of the last product synchronized for that filter in the DataSource
                6. Publication Latency computation as difference between the CreationDate of DataSource and FE
            */
            const sources = await utility.performDHuSServiceRequest(service, productSourcesUrl);
            wlogger.debug("Latency - Product Sources HTTP response");
            //console.log(sources);
            // Get info from odata/v1 synchronizers
            if (sources && sources.status == 404) {
                wlogger.info("Service " + service.service_url + " does not support Intelligent Synchronizers. Getting legacy synch list...")
                const synch = await utility.performDHuSServiceRequest(service, synchUrl);
                if(synch && synch.status == 200 && synch.data){

                    wlogger.debug(synch.data.d.results); 
                    const dataSourceStatus = (conf.getConfig().dataSourceStatus) ? conf.getConfig().dataSourceStatus : ["RUNNING", "PENDING"];
                    for (const element of synch.data.d.results) {
                        // Get measures only from active synchronizers
                        if (dataSourceStatus.indexOf(element.Status) >= 0 ) {
                            try {
                                // Synch ServiceUrl is the source Url in case of legacy synchronizers
                                const sourceUrl = element.ServiceUrl.split('/odata')[0];
                                // Retrieve the source from the configured services of DAFNE (mandatory to access the source with credentials, not provided by the synchronizer)
                                const sourceService = await getSourceService(sourceUrl);
                                if(!sourceService) {
                                    wlogger.warn(`The Data Source ${sourceUrl} is not configured among DAFNE services. Cannot compute the publication latency, 
                                    data source credentials are missing`);
                                    // TODO: insert N/A measure in the DAFNE DB

                                } else {
                                    if(element.FilterParam) {
                                        //Retrieve synchronizer LastCreationDate
                                        const lastCreationDate = moment(element.LastCreationDate).utc().format('YYYY-MM-DDTHH:mm:ss.SSS')+'Z';
                                        wlogger.info(`Finding on local BE ${service.service_url} the last synchronized product form Synch with Id = ${element.Id}, Label = ${element.Label},    
                                        sourceUrl =${sourceUrl}, FilterParam = ${element.FilterParam}`);
                                        let productUrlByFilterParam = searchProductByFilter;
                                        productUrlByFilterParam = productUrlByFilterParam.replace(':filter',element.FilterParam);
                                        wlogger.info(`Request to perform to local BE Service  ${service.service_url} is ${productUrlByFilterParam}`);
                                        //retrieve product in the BE
                                        const beProducts = await utility.performDHuSServiceRequest(service, productUrlByFilterParam);
                                        //compute Latency
                                        await manageLatency(beProducts, sourceUrl, sourceService, service, feService, frontEndUrl, lastCreationDate, element, centre, 
                                            productUrlByFilterParam, currentTimestamp);
                                    } else {
                                        wlogger.warn(`No FilterParam configured for Sync ${element.Id} - ${element.Label} on local BE ${service.service_url}. Cannot compute the publication latency.`);
                                    }
                                       
                                }
                            } catch (e) {
                                wlogger.error(`Error occurred while retrieving publication latency measure on local BE ${service.service_url}`);
                                wlogger.error(e);                                
                            }
                        }						
                    } 
                } else {
                    wlogger.error(`No synchronizer configured on local BE ${service.service_url}`);
                }
            } else if (sources && sources.status == 200 && sources.data) {
                sourceList = sources.data.value;
                wlogger.info("Local BE Service " + service.service_url + " is compliant with Intelligent Synchronizers. Getting synch list...")
                const intelliSynch = await utility.performDHuSServiceRequest(service, intelliSynchUrl);
                if(intelliSynch && intelliSynch.status == 200 && intelliSynch.data){

                    wlogger.debug(intelliSynch.data.value); 
                    // Check if Intelligent Synchronizer is Active from Cron.Active property
                    
                    for (const element of intelliSynch.data.value) {
                        if (element.Cron.Active) {
                            try {
                                let referencedSources = element.ReferencedSources;
                                wlogger.debug("referencedSources");
                                wlogger.debug(referencedSources);
                                const rs = utility.getActiveSource(referencedSources);
                                let selectedSource = sourceList.filter((arr) =>rs.ReferenceId==arr.Id);
                                const sourceUrl = selectedSource[0].Url.split('/odata')[0];
                                // Retrieve the source from the configured services of DAFNE (mandatory to access the source with credentials, not provided by the synchronizer)
                                const sourceService = await getSourceService(sourceUrl);
                                if(!sourceService) {
                                    wlogger.warn(`The Data Source ${sourceUrl} is not configured among DAFNE services. Cannot compute the publication latency, 
                                    data source credentials are missing`);
                                    // TODO: insert N/A measure in the DAFNE DB

                                } else {
                                    if (element.FilterParam) {
                                        //Retrieve synchronizer LastCreationDate
                                        const lastCreationDate = moment(rs.LastCreationDate).utc().format('YYYY-MM-DDTHH:mm:ss.SSS')+'Z';
                                        wlogger.info(`Finding on local BE ${service.service_url} the last synchronized product form Synch with Id = ${element.Id}, Label = ${element.Label},    
                                        sourceUrl =${sourceUrl}, FilterParam = ${element.FilterParam}`);
                                        let productUrlByFilterParam = searchProductByFilter;
                                        productUrlByFilterParam = productUrlByFilterParam.replace(':filter',element.FilterParam);
                                        wlogger.info(`Request to perform to local BE Service  ${service.service_url} is ${productUrlByFilterParam}`);
                                        //retrieve product in the BE
                                        const beProducts = await utility.performDHuSServiceRequest(service, productUrlByFilterParam);
                                        //compute Latency
                                        await manageLatency(beProducts, sourceUrl, sourceService, service, feService, frontEndUrl, lastCreationDate, element, centre, 
                                            productUrlByFilterParam, currentTimestamp);
                                    } else {
                                        wlogger.warn(`No FilterParam configured for Sync ${element.Id} - ${element.Label} on local BE ${service.service_url}. Cannot compute the publication latency.`);
                                    }
                                }
                            } catch (e) {
                                wlogger.error(`Error occurred while retrieving publication latency measure on local BE ${service.service_url}`);
                                wlogger.error(e)
                            }
                                                        	
                        }
                    }
                    //add log
                } else {
                    wlogger.error(`No intelligent synchronizer configured on local BE ${service.service_url}`);
                }

            } else {
                wlogger.info("Failed to retrieve sources and synch list for service " + service.service_url)
            }                        
        }         
	} catch (error) {
		wlogger.error(error);		
	}
    return status;
};

purgePublicationLatency = async() => {
    try {

        if(conf.getConfig().latency && conf.getConfig().latency.rollingPeriodInDays ) {
            if (isNaN(conf.getConfig().latency.rollingPeriodInDays)) {
                wlogger.warn(`The parameter latency.rollingPeriodInDay must be a number. Found value: ${conf.getConfig().latency.rollingPeriodInDays}`);
                wlogger.warn(`Using default: ${rollingPeriodInDays}`);
            } else {
                rollingPeriodInDays = conf.getConfig().latency.rollingPeriodInDays;
            }
        }
        var rollingDate = new Date();
        rollingDate.setDate(rollingDate.getDate()-rollingPeriodInDays);
        wlogger.info(`Start purging publication latency data older than ${rollingPeriodInDays}. Check date is ${rollingDate}`);
        const purgedRows = await PublicationLatency.destroy({
            where: { timestamp: {[Sequelize.Op.lt]: rollingDate} } 

        });
        wlogger.info(`Successfully purged ${purgedRows} rows in publication latency`);
    } catch (error) {
        wlogger.error("Errors occurred while purging publication latency");
        wlogger.error(error);
    }
    //where: { createdAt: {[Op.lt]: d,[Op.gte]: dy}}
}


exports.createScheduler = () => {
 
    try {
       
        if(conf.getConfig().latency && conf.getConfig().latency.schedule && conf.getConfig().latency.schedule !== '') {
            schedule = conf.getConfig().latency.schedule;
            wlogger.info("[Publication Latency] Use configuration file scheduler: " + schedule);
        } else {
            wlogger.info("[Publication Latency] No scheduler defined in configuration file for publication latency. Using default scheduler: " + schedule);
        }
        job = cron.schedule(schedule, async() => {
            wlogger.info("Start verifying publication latency...");
            const status = await checkPublicationLatency();           
        })
    } catch(error) {
        wlogger.error("Error occurred while creating scheduler for publication latency")
		wlogger.error(error);
	}
};

exports.checkAndUpdateScheduler = () => {
    try {
        wlogger.debug("[Publication Latency] Check configured schedule");
        let newPeriod = (conf.getConfig().latency && conf.getConfig().latency.schedule) ? conf.getConfig().latency.schedule : null;
        if(newPeriod && newPeriod != schedule ) {
            wlogger.info("[Publication Latency] Reschedule job, found new scheduling period: " + newPeriod);
            schedule = newPeriod;
            if (job) {
                wlogger.info("Found not null job");	
                job.stop();
                
                job = cron.schedule(schedule, async() => {
                    wlogger.info("Start verifying publication latency...");
                    const status = await checkPublicationLatency();      
                })

            } else {
                wlogger.info("No jobs found");
            }
        }
    } catch(error) {
        wlogger.error("Error occurred while updating scheduler for publication latency")
        wlogger.error(error);
    }
};

exports.createPurgeScheduler = () => {
 
    try {

        if(conf.getConfig().latency && conf.getConfig().latency.hasOwnProperty('enablePurge')) {
            enablePurge = conf.getConfig().latency.enablePurge;
        }
        if(enablePurge) {
       
            if(conf.getConfig().latency && conf.getConfig().latency.purgeSchedule && conf.getConfig().latency.purgeSchedule !== '') {
                purgeSchedule = conf.getConfig().latency.purgeSchedule;
                wlogger.info("[Publication Latency] Use configuration file purgeSchedule: " + purgeSchedule);
            } else {
                wlogger.info("[Publication Latency] No purgeSchedule defined in configuration file for publication latency. Using default purgeSchedule: " + purgeSchedule);
            }
            purgeJob = cron.schedule(purgeSchedule, async() => {
                wlogger.info("Start purging publication latency...");
                await purgePublicationLatency();           
            })
        } else {
            wlogger.info("Publication latency purge is disabled. Please check your parameters if you want to enable it.");
        }
    } catch(error) {
        wlogger.error("Error occurred while creating purgeSchedule for publication latency")
		wlogger.error(error);
	}
};

/**
 * This method implements the retry mechanism, configurable in terms of frequency and maximum number of retries, useful to retrieve a product on FE 
 */
checkMissingFrontEndLatency = async () => {
	try {
        if(conf.getConfig().latency && conf.getConfig().latency.feMaxRetry ) {
            if (isNaN(conf.getConfig().latency.feMaxRetry)) {
                wlogger.warn(`The parameter latency.feMaxRetry must be a number. Found value: ${conf.getConfig().latency.feMaxRetry}`);
                wlogger.warn(`Using default: ${feMaxRetry}`);
            } else {
                feMaxRetry = conf.getConfig().latency.feMaxRetry;
            }
        }
		
		const centre = await Centre.findOne({
			where: {
				local: true
			}
		});
        const feService = await Service.findOne({
			where: {
				centre: centre.id,
				service_type: {
					[Sequelize.Op.in]: [1, 2]  //Exclude BE services from services
				}
			},
            order: [['service_type', 'DESC']] //Order by service_type DESC to get the FE in case an FE + Single Instance configured (not a real case)
		});               
        const feLatencyList = await PublicationLatency.findAll({
            where: {
                centre_id: centre.id,
                retry: {[Sequelize.Op.lt]: feMaxRetry},
                latency_be: {[Sequelize.Op.ne]: null},
                latency_fe: {[Sequelize.Op.eq]: null}
            },            
            order: [['timestamp', 'DESC']]
        });
        for (const feLatency of feLatencyList) {
            //console.log(feLatency);
            let product;
            let description;
            const currentRetry = feLatency['retry'] + 1;
            // Search on the local FE the referenced products used to compute Back-End latency and not yet found on FE
            if (feService) {
                let searchProductOnFeAndSource = searchProductOnService;
                searchProductOnFeAndSource = searchProductOnFeAndSource.replace(':name',feLatency['product_name']);
                wlogger.info(`Performing request ${searchProductOnFeAndSource} on Local FE ${feService.service_url} for retrieving product ${feLatency['product_name']} - ${feLatency['product_id']}.`);
                const products = await utility.performDHuSServiceRequest(feService, searchProductOnFeAndSource);
                if(products && products.status == 200 && products.data && products.data.value && products.data.value.length > 0) { 
                    product =  products.data.value[0];
                    wlogger.info(`Found product ${feLatency['product_name']} - ${feLatency['product_id']} on Local FE ${feService.service_url} after ${currentRetry} attempts.`);
                    //compute latency in reference with local FE
                } else {
                    wlogger.info(`Cannot find yet product ${feLatency['product_name']} - ${feLatency['product_id']} on Local FE ${feService.service_url} after ${currentRetry} attempts.`);
                    description = `Cannot find yet product ${feLatency['product_name']} - ${feLatency['product_id']} on Local FE after ${currentRetry} attempts.`;
                }
            } else {
                wlogger.warn(`Cannot compute publication latency on local FE - No FE Service configured`);
                description = `Cannot find yet product ${feLatency['product_name']} - ${feLatency['product_id']} on Local FE after ${currentRetry} attempts.`;
                
            }
            const latencyFe =  (product) ? (new Date(product.CreationDate) - new Date(feLatency['creation_date_source'])) : null;     
            // update retry
            let latency = {retry: currentRetry, latency_fe: latencyFe, description: description};
            const updatedLatency = await PublicationLatency.update(latency, { where: { id: feLatency['id'] } });   
            wlogger.debug(`Updated latency for product ${feLatency['product_name']} - ${feLatency['product_id']} on Local FE ${feService.service_url} 
            after ${currentRetry} attempts. New FE latency is ${latencyFe}`);
            //wlogger.debug(updatedLatency);
        }   
           
	} catch (error) {
		wlogger.error(error);		
	}
};

exports.createFeRetryScheduler = () => {
 
    try {
       
        if(conf.getConfig().latency && conf.getConfig().latency.feRetrySchedule && conf.getConfig().latency.feRetrySchedule !== '') {
            feRetrySchedule = conf.getConfig().latency.feRetrySchedule;
            wlogger.info("[Publication Latency - FE Retry] Use configuration file scheduler for missing FE latency: " + feRetrySchedule);
        } else {
            wlogger.info("[Publication Latency - FE Retry] No scheduler defined in configuration file for missing FE publication latency. Using default scheduler: " + feRetrySchedule);
        }
        feRetryJob = cron.schedule(feRetrySchedule, async() => {
            wlogger.info("Start verifying missing FE publication latency...");
            const status = await checkMissingFrontEndLatency();           
        })
    } catch(error) {
        wlogger.error("Error occurred while creating scheduler for missing FE publication latency")
		wlogger.error(error);
	}
};

exports.checkAndUpdateFeRetryScheduler = () => {
    try {
        wlogger.debug("[Publication Latency - FE Retry] Check configured schedule");
        let newPeriod = (conf.getConfig().latency && conf.getConfig().latency.feRetrySchedule) ? conf.getConfig().latency.feRetrySchedule : null;
        if(newPeriod && newPeriod != feRetrySchedule ) {
            wlogger.info("[Publication Latency - FE Retry] Reschedule job, found new scheduling period: " + newPeriod);
            feRetrySchedule = newPeriod;
            if (feRetryJob) {
                wlogger.info("Found not null job");	
                feRetryJob.stop();
                
                feRetryJob = cron.schedule(feRetrySchedule, async() => {
                    wlogger.info("Start verifying missing FE publication latency...");
                    const status = await checkMissingFrontEndLatency();      
                })

            } else {
                wlogger.info("No jobs found for missing FE publication latency");
            }
        }
    } catch(error) {
        wlogger.error("Error occurred while updating scheduler for missing FE publication latency")
        wlogger.error(error);
    }
};

