const wlogger = require('../util/wlogger');
const conf = require('../util/config');

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

/** [GET] /config/latency/rollingPeriodInDays
 *   Return the configured latency rollingPeriodInDays 
 */
exports.latencyRollingPeriod = async (req, res) => {
  try {
    rollingPeriodInDays = (conf.getConfig().latency && conf.getConfig().latency.rollingPeriodInDays) ? conf.getConfig().latency.rollingPeriodInDays : 90;
    return res.status(200).json(rollingPeriodInDays);    
  } catch (error) {
    wlogger.error("Generic error in configured latency rollingPeriodInDays : " + error);
    return res.status(500).json('Error getting configured latency rollingPeriodInDays');
  }
};


