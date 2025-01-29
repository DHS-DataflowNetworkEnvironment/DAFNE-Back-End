//Models imports
const axios = require('axios');
const Centre = require("../models/centre");
const Service = require("../models/service");
const ServiceAVailability = require("../models/service_availability");
const Sequelize = require('sequelize');
const urljoin = require('url-join');
const Utilcrypto = require('../util/Utilcrypto');
const wlogger = require('../util/wlogger');
const conf = require('../util/config');
const  cron = require('node-cron');

let job;
let purgeJob;
// default check availability schedule 10 minutes
let schedule = "*/10 * * * *";
// default purge availability table, evry day at 01:00 AM
let purgeSchedule = "0 1 * * *";
// default availability rolling period 90 days
let rollingPeriodInDays = 90;
let enablePurge = true;
let isGSS = false;
let availability_endpoint = "odata/v1/Products?$top=1";

checkServiceAVailability = async () => {
	let status = 0;
	let timeout;
	try {
		
		const centre = await Centre.findOne({
			where: {
				local: true
			}
		});
        const service = await Service.findOne({
			where: {
				centre: centre.id,
				service_type: {
					[Sequelize.Op.in]: [1, 2, 7]  //Exclude BE services from services - Added GSS(7) to the suitable services
				}
			},
            order: [['service_type', 'DESC']] //Order by service_type DESC to get the FE in case an FE + Single Instance configured (not a real case)
		});

		let currentTimestamp = new Date().getTime();
        if(service) {
            // check service availability for local centre            
            if (service.service_type == 7) {
                isGSS = true;
            } else {
                isGSS = false;
            }
            let timeout;
            let description;
            let availability_url;
            try {
                if (isGSS == true) {
                    if(conf.getConfig().availability && conf.getConfig().availability.urlGSS ) {
                        availability_endpoint = conf.getConfig().availability.urlGSS;
                    }
                 } else {
                    if(conf.getConfig().availability && conf.getConfig().availability.url ) {
                        availability_endpoint = conf.getConfig().availability.url;
                    }
                }
                wlogger.info("Availability endpoint is; " + availability_endpoint);
                
                const source = axios.CancelToken.source();
                let requestTimeout = (conf.getConfig().requestTimeout) ? conf.getConfig().requestTimeout : 30000;
                let startDate = new Date().getTime();
                timeout = setTimeout(() => {
                    source.cancel();
                    wlogger.error("No response received from Service " + service.service_url + " while checking availability"); 
                    wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
                }, requestTimeout);
                availability_url = urljoin(service.service_url, availability_endpoint);
                const availability = await axios({
                    method: 'get',
                    url: availability_url,
                    auth: {
                        username: service.username,
                        password: Utilcrypto.decrypt(service.password)
                    },
                    validateStatus: false,
                    cancelToken: source.token
                    
                }).catch(err => {
                    if (err.response) {
                        // client received an error response (5xx, 4xx)
                        try {
                            description = (err.toJSON()).message;
                        } catch (e) {
                            description = "Received error response from Service while checking availability " + service.service_url;
                        }
                        wlogger.error("Received error response from Service while checking availability " + service.service_url); 
                        wlogger.error(err);
                        //console.log(err.toJSON());
                    } else if (err.request) {
                        try {
                            description = (err.toJSON()).message;
                        } catch (e) {
                            description = "No response received from Service while checking availability " + service.service_url;
                        }
                        // client never received a response, or request never left
                        wlogger.error("No response received from Service while checking availability " + service.service_url); 
                        wlogger.error(err);
                        //console.log(err.toJSON());                       
                    } else {
                        try {
                            description = (err.toJSON()).message;
                        } catch (e) {
                            description = "Error from Service while checking availability " + service.service_url;
                        }
                        // anything else
                        wlogger.error("Error from Service while checking availability " + service.service_url); 
                        wlogger.error(err);
                        //console.log(err.toJSON());
                    }
                });
                let stopDate = new Date().getTime();
                // Clear The Timeout
                clearTimeout(timeout);
                if (availability && availability.statusText) {
                    description = (description) ? description + " - " + availability.statusText : availability.statusText;
                }          
                let status = (availability && availability.status) ? availability.status : null;
                let responseTime = (stopDate && startDate) ? stopDate - startDate : null;
                // Insert measure in DB
                const service_availability = await ServiceAVailability.create({
                    service_url: service.service_url,
                    centre_id: centre.id,
                    timestamp: currentTimestamp,
                    http_request: availability_url,
                    http_status_code: status,
                    http_response_time: responseTime,
                    description: description

                });
                wlogger.debug(service_availability);
                wlogger.info(`Added new availability measure with values: service_url - ${service.service_url}, centre_id - ${centre.id}, timestamp - ${currentTimestamp}, 
                http_request - ${availability_url}, http_status_code -  ${status}, http_response_time - ${responseTime}, description - ${description}`);
                
            } catch (e) {
                wlogger.error("Error checking availability for centre " + centre.id + " at " + currentTimestamp);
                wlogger.error(e)
            }
            
        } else {
            wlogger.error("No suitable service found for centre " + centre.id + ". Cannot check local availability at " + currentTimestamp);
        }
        
	} catch (error) {
		wlogger.error(error);
		
	}
    return status;
};

purgeServiceAvailability = async() => {
    try {

        if(conf.getConfig().availability && conf.getConfig().availability.rollingPeriodInDays ) {
            if (isNaN(conf.getConfig().availability.rollingPeriodInDays)) {
                wlogger.warn(`The parameter availability.rollingPeriodInDay must be a number. Found value: ${conf.getConfig().availability.rollingPeriodInDays}`);
                wlogger.warn(`Using default: ${rollingPeriodInDays}`);
            } else {
                rollingPeriodInDays = conf.getConfig().availability.rollingPeriodInDays;
            }
        }
        var rollingDate = new Date();
        rollingDate.setDate(rollingDate.getDate()-rollingPeriodInDays);
        wlogger.info(`Start purging service availability data older than ${rollingPeriodInDays}. Check date is ${rollingDate}`);
        const purgedRows = await ServiceAVailability.destroy({
            where: { timestamp: {[Sequelize.Op.lt]: rollingDate} } 

        });
        wlogger.info(`Successfully purged ${purgedRows} rows in service availability`);
    } catch (error) {
        wlogger.error("Errors occurred while purging service availability");
        wlogger.error(error);
    }
    //where: { createdAt: {[Op.lt]: d,[Op.gte]: dy}}
}


exports.createScheduler = () => {
 
    try {
       
        if(conf.getConfig().availability && conf.getConfig().availability.schedule && conf.getConfig().availability.schedule !== '') {
            schedule = conf.getConfig().availability.schedule;
            wlogger.info("[Service Availability] Use configuration file scheduler: " + schedule);
        } else {
            wlogger.info("[Service Availability] No scheduler defined in configuration file for service availability. Using default scheduler: " + schedule);
        }
        job = cron.schedule(schedule, async() => {
            wlogger.info("Start verifying service availability...");
            const status = await checkServiceAVailability();           
        })
    } catch(error) {
        wlogger.error("Error occurred while creating scheduler for service availability")
		wlogger.error(error);
	}
};

exports.checkAndUpdateScheduler = () => {
    try {
        wlogger.debug("[Service Availability] Check configured schedule");
        let newPeriod = (conf.getConfig().availability && conf.getConfig().availability.schedule) ? conf.getConfig().availability.schedule : null;
        if(newPeriod && newPeriod != schedule ) {
            wlogger.info("[Service Availability] Reschedule job, found new scheduling period: " + newPeriod);
            schedule = newPeriod;
            if (job) {
                wlogger.info("Found not null job");	
                job.stop();
                
                job = cron.schedule(schedule, async() => {
                    wlogger.info("Start verifying service availability...");
                    const status = await checkServiceAVailability();       
                })

            } else {
                wlogger.info("No jobs found");
            }
        }
    } catch(error) {
        wlogger.error("Error occurred while updating scheduler for service availability")
        wlogger.error(error);
    }
};

exports.createPurgeScheduler = () => {
 
    try {

        if(conf.getConfig().availability && conf.getConfig().availability.hasOwnProperty('enablePurge')) {
            enablePurge = conf.getConfig().availability.enablePurge;
        }
        if(enablePurge) {
       
            if(conf.getConfig().availability && conf.getConfig().availability.purgeSchedule && conf.getConfig().availability.purgeSchedule !== '') {
                purgeSchedule = conf.getConfig().availability.purgeSchedule;
                wlogger.info("[Service Availability] Use configuration file purgeSchedule: " + purgeSchedule);
            } else {
                wlogger.info("[Service Availability] No purgeSchedule defined in configuration file for service availability. Using default purgeSchedule: " + purgeSchedule);
            }
            purgeJob = cron.schedule(purgeSchedule, async() => {
                wlogger.info("Start purging service availability...");
                await purgeServiceAvailability();           
            })
        } else {
            wlogger.info("Service availability purge is disabled. Please check your parameters if you want to enable it.");
        }
    } catch(error) {
        wlogger.error("Error occurred while creating purgeSchedule for service availability")
		wlogger.error(error);
	}
};

