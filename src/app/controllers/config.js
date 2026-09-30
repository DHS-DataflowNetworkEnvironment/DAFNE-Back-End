const wlogger = require('app/util/wlogger');
const conf = require('app/util/config');

/** [GET] /config/availability/rollingPeriodInDays
 *   Return the configured availability rollingPeriodInDays 
 */
exports.availabilityRollingPeriod = async (req, res) => {
  try {
    rollingPeriodInDays = (conf.getConfig().availability && conf.getConfig().availability.rollingPeriodInDays) ? conf.getConfig().availability.rollingPeriodInDays : 90;
    return res.status(200).json(rollingPeriodInDays);    
  } catch (error) {
    wlogger.error("Generic error in configured availability rollingPeriodInDays : " + error);
    return res.status(500).json('Error getting configured availability rollingPeriodInDays');
  }
};

/** [GET] /config/timeliness/rollingPeriodInDays
 *   Return the configured timeliness rollingPeriodInDays 
 */
exports.timelinessRollingPeriod = async (req, res) => {
  try {
    rollingPeriodInDays = (conf.getConfig().timeliness && conf.getConfig().timeliness.rollingPeriodInDays) ? conf.getConfig().timeliness.rollingPeriodInDays : 90;
    return res.status(200).json(rollingPeriodInDays);    
  } catch (error) {
    wlogger.error("Generic error in configured timeliness rollingPeriodInDays : " + error);
    return res.status(500).json('Error getting configured timeliness rollingPeriodInDays');
  }
};

/** [GET] /config/getClientId
 *  Return the configurated clientId to the front-end
 */
exports.clientId = async (req, res) => {
  try {
    clientId = (conf.getConfig().auth && conf.getConfig().auth.clientId) ? conf.getConfig().auth.clientId : "dafne";
    return res.status(200).json(clientId);
  } catch (error) {
    wlogger.error("Generic error in configured clientId : " + error);
    return res.status(500).json('Error getting configured clientId');
  }
}