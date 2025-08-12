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

// default check Front-End publication timeliness schedule 5 minutes
let feRetrySchedule = "*/5 * * * *";
// default Front-End publication timeliness number of retries
let feMaxRetry = 10;

const synchUrl = 'odata/v1/Synchronizers';
const productSourcesUrl = 'odata/v2/ProductSources';
const intelliSynchUrl = 'odata/v2/Synchronizers?$expand=ReferencedSources';
const searchProductByFilter = 'odata/v1/Products?$filter=:filter&$orderby=CreationDate asc&$top=1';
const searchProductOnService = "odata/v2/Products?$filter=Name eq ':name'&$top=1";


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
   Method used to compute timeliness checking data retrieved from local BE, FE and Referenced Data Source
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
manageTimeliness = async (sourceProducts, sourceUrl, sourceService, service, feService, frontEndUrl, lastCreationDate, element, centre, productUrlByDate, currentTimestamp) => {
    
    try {
        let description;
        if(sourceProducts && sourceProducts.status == 200 && sourceProducts.data && sourceProducts.data.d.results && sourceProducts.data.d.results.length > 0) {                                        
            const sourceProduct =  sourceProducts.data.d.results[0];
            const sourceProductCreationDate = moment(sourceProduct.CreationDate).utc().format('YYYY-MM-DDTHH:mm:ss.SSS')+'Z';
            wlogger.info(`Found product ${sourceProduct.Name} - ${sourceProduct.Id} on Reference Source  ${sourceService.service_url} with CreationDate 
            ${sourceProductCreationDate}. Searching product on local BE ${service.service_url}`);
            //retrieve product on local BE
            wlogger.info(`Finding Product ${sourceProduct.Name} on local BE ${service.service_url}`);
            let searchProductOnFeAndBe = searchProductOnService;
            searchProductOnFeAndBe = searchProductOnFeAndBe.replace(':name',sourceProduct.Name);
            const beProducts = await utility.performDHuSServiceRequest(service, searchProductOnFeAndBe);
            let feProduct;
            let beProduct;
            
            if(beProducts && beProducts.status == 200 && beProducts.data && beProducts.data.value && beProducts.data.value.length > 0) { 
                beProduct =  beProducts.data.value[0];
                wlogger.info(`Found product ${beProduct.Name} - ${beProduct.Id} on local BE ${service.service_url} with CreationDate ${beProduct.CreationDate}.`);
                //retrieve product on FE
                if(feService) {
                    
                    const feProducts = await utility.performDHuSServiceRequest(feService, searchProductOnFeAndBe);
                    
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
               
                const timelinessBe =  new Date(beProduct.CreationDate) - new Date(sourceProductCreationDate);
                const timelinessFe =  (feProduct) ? (new Date(feProduct.CreationDate) - new Date(sourceProductCreationDate)) : null;                                            
                const creationDateFe = (feProduct) ? feProduct.CreationDate : null;
                const publication_timeliness = await PublicationTimeliness.create({
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
                    creation_date_be: beProduct.CreationDate,
                    creation_date_fe: creationDateFe,
                    creation_date_source: sourceProductCreationDate,
                    latency_be: timelinessBe,
                    latency_fe: timelinessFe,
                    description: description
                });
                wlogger.debug(publication_timeliness);
                wlogger.info(`Added new publication timeliness measure with values: timestamp - ${currentTimestamp}, backend_url - ${service.service_url}, frontend_url - ${frontEndUrl},
                centre_id - ${centre.id}, synch_id -  ${element.Id}, synch_label - ${element.Label}, synch_filter - ${element.FilterParam}, synch_geo_filter - ${element.GeoFilter}
                source_url - ${sourceUrl}, source_last_creation_date -  ${lastCreationDate}, product_name - ${beProduct.Name}, product_id - ${beProduct.Id}, creation_date_be - ${beProduct.CreationDate}
                creation_date_fe - ${creationDateFe}, creation_date_source -  ${sourceProductCreationDate}, latency_be - ${timelinessBe}, latency_fe - ${timelinessFe}`);
            }
            else {
                wlogger.warn(`Cannot find product ${sourceProduct.Name} on local BE. Publication Timeliness cannot be computed`);
                description = `Cannot find product ${sourceProduct.Name} on local BE.`;
                const publication_timeliness = await PublicationTimeliness.create({
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
                    product_name: sourceProduct.Name,
                    product_id: sourceProduct.Id,
                    creation_date_source: sourceProductCreationDate,
                    description: description
                });
                wlogger.debug(publication_timeliness);
                wlogger.info(`Added new publication timeliness measure with values: timestamp - ${currentTimestamp}, backend_url - ${service.service_url}, frontend_url - ${frontEndUrl},
                centre_id - ${centre.id}, synch_id -  ${element.Id}, synch_label - ${element.Label}, synch_filter - ${element.FilterParam}, synch_geo_filter - ${element.GeoFilter}
                source_url - ${sourceUrl}, source_last_creation_date -  ${lastCreationDate}, product_name - ${sourceProduct.Name}, product_id - ${sourceProduct.Id}, creation_date_source - ${sourceProductCreationDate}, 
                description - ${description}`);
            }                                                                        
        } else {
            wlogger.warn(`No products found on reference source ${sourceUrl} performing request ${productUrlByDate}. Publication Timeliness cannot be computed`);
            description = `No products found on reference source ${sourceUrl} related to Synchronizer ${element.Id} - ${element.Label}`;
            const publication_timeliness = await PublicationTimeliness.create({
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
            wlogger.debug(publication_timeliness);
            wlogger.info(`Added new publication timeliness measure with values: timestamp - ${currentTimestamp}, backend_url - ${service.service_url}, centre_id - ${centre.id}, 
            synch_id -  ${element.Id}, synch_label - ${element.Label}, synch_filter - ${element.FilterParam}, synch_geo_filter - ${element.GeoFilter}, source_url - ${sourceUrl}, 
            source_last_creation_date -  ${lastCreationDate}, description - ${description}`);
        }
    } catch (err) {
        wlogger.error(`Error while computing Publication Timeliness on reference source ${sourceUrl} related to Synchronizer ${element.Id} - ${element.Label}`)
        wlogger.error(err);
    }
}




checkPublicationTimeliness = async () => {
	let status = 0;    
	try {
        let timelinessTolerance = (conf.getConfig().timeliness && conf.getConfig().timeliness.tolerance) ? conf.getConfig().timeliness.tolerance : 1;
		
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
            wlogger.error("No suitable service found for centre " + centre.id + ". Cannot check local publication timeliness at " + currentTimestamp);
        }
        for (const service of services) {
            // check publication timeliness for local centre
            /*
                1. Identification of synchronizer configured, present on the BEs of the local center.
                2. Identification of the updated CreationDate for that synch. 
                   (In the case of Intelligent Synchronizers the Latest CreationDate configured within the ProductSource associated to the synch)
                3. Identification of the last product synchronized for that filter in the DataSource
                4. Identification of the last product synchronized for that filter in the BE instance associated to the local centre
                5. Identification of the same product synchronized for that filter in the FE instance associated to the local centre                
                6. Publication Timeliness computation as difference between the CreationDate of DataSource and FE
            */
            const sources = await utility.performDHuSServiceRequest(service, productSourcesUrl);
            wlogger.debug("Timeliness - Product Sources HTTP response");
            //console.log(sources);
            // Get info from odata/v1 synchronizers
            if (sources && sources.status == 404) {
                wlogger.info("Publication Timeliness: Service " + service.service_url + " does not support Intelligent Synchronizers. Getting legacy synch list...")
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
                                    wlogger.warn(`The Data Source ${sourceUrl} is not configured among DAFNE services. Cannot compute the publication timeliness, 
                                    data source credentials are missing`);
                                    

                                } else {
                                    let requestFilter;
                                    //Retrieve synchronizer LastCreationDate
                                    const lastCreationDate = moment(element.LastCreationDate).utc().format('YYYY-MM-DDTHH:mm:ss.SSS')+'Z';
                                    const lastCreationDateMin = moment(element.LastCreationDate).utc().subtract(timelinessTolerance,'seconds').format('YYYY-MM-DDTHH:mm:ss.SSS');
                                    const lastCreationDateMax = moment(element.LastCreationDate).utc().add(timelinessTolerance,'seconds').format('YYYY-MM-DDTHH:mm:ss.SSS');
                                    if(element.FilterParam) {
                                        requestFilter = `${element.FilterParam } and CreationDate ge datetime'${lastCreationDateMin}' and CreationDate le datetime'${lastCreationDateMax}'`;
                                    } else {
                                        requestFilter = `CreationDate ge datetime'${lastCreationDateMin}' and CreationDate le datetime'${lastCreationDateMax}'`;
                                        wlogger.warn(`No FilterParam configured for Sync ${element.Id} - ${element.Label} on local BE ${service.service_url}. Compute the publication timeliness based only on CreationDate`);
                                    }
                                    wlogger.info(`Finding on Referenced Source ${sourceService.service_url} the last synchronized product from Synch with Id = ${element.Id}, Label = ${element.Label},    
                                    sourceUrl =${sourceUrl}, FilterParam = ${element.FilterParam}, LastCreationDate = ${element.LastCreationDate}`);
                                    wlogger.info(`The last synchronized product will be searched with a tolerance interval of ${timelinessTolerance} second(s), with a Creation Date   
                                    between ${lastCreationDateMin} and ${lastCreationDateMax}`);
                                    
                                    let productUrlByFilterParam = searchProductByFilter;
                                    productUrlByFilterParam = productUrlByFilterParam.replace(':filter',requestFilter);
                                    wlogger.info(`Request to perform on Referenced Source  ${sourceService.service_url} is ${productUrlByFilterParam}`);
                                    //retrieve product in the Referenced Source
                                    const sourceProducts = await utility.performDHuSServiceRequest(sourceService, productUrlByFilterParam);
                                    //compute Timeliness
                                    await manageTimeliness(sourceProducts, sourceUrl, sourceService, service, feService, frontEndUrl, lastCreationDate, element, centre, 
                                        productUrlByFilterParam, currentTimestamp);                                       
                                }
                            } catch (e) {
                                wlogger.error(`Error occurred while retrieving publication timeliness measure on local BE ${service.service_url}`);
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
                                    wlogger.warn(`The Data Source ${sourceUrl} is not configured among DAFNE services. Cannot compute the publication timeliness, 
                                    data source credentials are missing`);
                                    // TODO: insert N/A measure in the DAFNE DB

                                } else {
                                    let requestFilter;
                                    //Retrieve synchronizer LastCreationDate
                                    const lastCreationDate = moment(rs.LastCreationDate).utc().format('YYYY-MM-DDTHH:mm:ss.SSS')+'Z';
                                    const lastCreationDateMin = moment(rs.LastCreationDate).utc().subtract(timelinessTolerance,'seconds').format('YYYY-MM-DDTHH:mm:ss.SSS');
                                    const lastCreationDateMax = moment(rs.LastCreationDate).utc().add(timelinessTolerance,'seconds').format('YYYY-MM-DDTHH:mm:ss.SSS');
                                    if (element.FilterParam) {
                                        requestFilter = `${element.FilterParam } and CreationDate ge datetime'${lastCreationDateMin}' and CreationDate le datetime'${lastCreationDateMax}'`;
                                    } else {
                                        requestFilter = `CreationDate ge datetime'${lastCreationDateMin}' and CreationDate le datetime'${lastCreationDateMax}'`;
                                        wlogger.warn(`No FilterParam configured for Sync ${element.Id} - ${element.Label} on local BE ${service.service_url}. Compute the publication timeliness based only on CreationDate`);
                                    }
                                    wlogger.info(`Finding on Referenced Source ${sourceService.service_url} the last synchronized product from Synch with Id = ${element.Id}, Label = ${element.Label},    
                                    sourceUrl =${sourceUrl}, FilterParam = ${element.FilterParam}, LastCreationDate = ${lastCreationDate}`);
                                    wlogger.info(`The last synchronized product will be searched with a tolerance interval of ${timelinessTolerance} second(s), with a Creation Date   
                                    between ${lastCreationDateMin} and ${lastCreationDateMax}`);
                                    
                                    let productUrlByFilterParam = searchProductByFilter;
                                    productUrlByFilterParam = productUrlByFilterParam.replace(':filter',requestFilter);
                                    wlogger.info(`Request to perform on Referenced Source ${sourceService.service_url} is ${productUrlByFilterParam}`);
                                    //retrieve product in the Reference Source
                                    const sourceProducts = await utility.performDHuSServiceRequest(sourceService, productUrlByFilterParam);
                                    //compute Timeliness
                                    await manageTimeliness(sourceProducts, sourceUrl, sourceService, service, feService, frontEndUrl, lastCreationDate, element, centre, 
                                        productUrlByFilterParam, currentTimestamp);
                                }
                            } catch (e) {
                                wlogger.error(`Error occurred while retrieving publication timeliness measure on local BE ${service.service_url}`);
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
    //where: { createdAt: {[Op.lt]: d,[Op.gte]: dy}}
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

/**
 * This method implements the retry mechanism, configurable in terms of frequency and maximum number of retries, useful to retrieve a product on FE 
 */
checkMissingFrontEndTimeliness = async () => {
	try {
        if(conf.getConfig().timeliness && conf.getConfig().timeliness.feMaxRetry ) {
            if (isNaN(conf.getConfig().timeliness.feMaxRetry)) {
                wlogger.warn(`The parameter timeliness.feMaxRetry must be a number. Found value: ${conf.getConfig().timeliness.feMaxRetry}`);
                wlogger.warn(`Using default: ${feMaxRetry}`);
            } else {
                feMaxRetry = conf.getConfig().timeliness.feMaxRetry;
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
        const feTimelinessList = await PublicationTimeliness.findAll({
            where: {
                centre_id: centre.id,
                retry: {[Sequelize.Op.lt]: feMaxRetry},
                latency_be: {[Sequelize.Op.ne]: null},
                latency_fe: {[Sequelize.Op.eq]: null}
            },            
            order: [['timestamp', 'DESC']]
        });
        for (const feTimeliness of feTimelinessList) {
            let product;
            let description;
            const currentRetry = feTimeliness['retry'] + 1;
            // Search on the local FE the referenced products used to compute Back-End timeliness and not yet found on FE
            if (feService) {
                let searchProductOnFeAndBe = searchProductOnService;
                searchProductOnFeAndBe = searchProductOnFeAndBe.replace(':name',feTimeliness['product_name']);
                wlogger.info(`Performing request ${searchProductOnFeAndBe} on Local FE ${feService.service_url} for retrieving product ${feTimeliness['product_name']} - ${feTimeliness['product_id']}.`);
                const products = await utility.performDHuSServiceRequest(feService, searchProductOnFeAndBe);
                if(products && products.status == 200 && products.data && products.data.value && products.data.value.length > 0) { 
                    product =  products.data.value[0];
                    wlogger.info(`Found product ${feTimeliness['product_name']} - ${feTimeliness['product_id']} on Local FE ${feService.service_url} after ${currentRetry} attempts.`);
                    //compute timeliness in reference with local FE
                } else {
                    wlogger.info(`Cannot find yet product ${feTimeliness['product_name']} - ${feTimeliness['product_id']} on Local FE ${feService.service_url} after ${currentRetry} attempts.`);
                    description = `Cannot find yet product ${feTimeliness['product_name']} - ${feTimeliness['product_id']} on Local FE after ${currentRetry} attempts.`;
                }
            } else {
                wlogger.warn(`Cannot compute publication timeliness on local FE - No FE Service configured`);
                description = `Cannot find yet product ${feTimeliness['product_name']} - ${feTimeliness['product_id']} on Local FE after ${currentRetry} attempts.`;
                
            }
            const timelinessFe =  (product) ? (new Date(product.CreationDate) - new Date(feTimeliness['creation_date_source'])) : null;     
            // update retry
            let timeliness = {retry: currentRetry, latency_fe: timelinessFe, description: description};
            const updatedTimeliness = await PublicationTimeliness.update(timeliness, { where: { id: feTimeliness['id'] } });   
            wlogger.debug(`Updated timeliness for product ${feTimeliness['product_name']} - ${feTimeliness['product_id']} on Local FE ${feService.service_url} 
            after ${currentRetry} attempts. New FE timeliness is ${timelinessFe}`);
        }   
           
	} catch (error) {
		wlogger.error(error);		
	}
};

exports.createFeRetryScheduler = () => {
 
    try {
       
        if(conf.getConfig().timeliness && conf.getConfig().timeliness.feRetrySchedule && conf.getConfig().timeliness.feRetrySchedule !== '') {
            feRetrySchedule = conf.getConfig().timeliness.feRetrySchedule;
            wlogger.info("[Publication Timeliness - FE Retry] Use configuration file scheduler for missing FE timeliness: " + feRetrySchedule);
        } else {
            wlogger.info("[Publication Timeliness - FE Retry] No scheduler defined in configuration file for missing FE publication timeliness. Using default scheduler: " + feRetrySchedule);
        }
        feRetryJob = cron.schedule(feRetrySchedule, async() => {
            wlogger.info("Start verifying missing FE publication timeliness...");
            const status = await checkMissingFrontEndTimeliness();           
        })
    } catch(error) {
        wlogger.error("Error occurred while creating scheduler for missing FE publication timeliness")
		wlogger.error(error);
	}
};

exports.checkAndUpdateFeRetryScheduler = () => {
    try {
        wlogger.debug("[Publication Timeliness - FE Retry] Check configured schedule");
        let newPeriod = (conf.getConfig().timeliness && conf.getConfig().timeliness.feRetrySchedule) ? conf.getConfig().timeliness.feRetrySchedule : null;
        if(newPeriod && newPeriod != feRetrySchedule ) {
            wlogger.info("[Publication Timeliness - FE Retry] Reschedule job, found new scheduling period: " + newPeriod);
            feRetrySchedule = newPeriod;
            if (feRetryJob) {
                wlogger.info("Found not null job");	
                feRetryJob.stop();
                
                feRetryJob = cron.schedule(feRetrySchedule, async() => {
                    wlogger.info("Start verifying missing FE publication timeliness...");
                    const status = await checkMissingFrontEndTimeliness();      
                })

            } else {
                wlogger.info("No jobs found for missing FE publication timeliness");
            }
        }
    } catch(error) {
        wlogger.error("Error occurred while updating scheduler for missing FE publication timeliness")
        wlogger.error(error);
    }
};

