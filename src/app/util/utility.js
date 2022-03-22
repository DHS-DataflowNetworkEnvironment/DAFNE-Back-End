const wlogger = require('../util/wlogger');
const conf = require('../util/config');
const axios = require('axios');
const urljoin = require('url-join');
const Utilcrypto = require('../util/Utilcrypto');

const regex_substring = /^.*substringof\('(.*)',Name\).*/gm;
const regex_startswith = /^.*startswith\(Name,'(.*)'\).*/gm;
const regex_endswith = /^.*endswith\(Name,'(.*)'\).*/gm;
const regex_contains = /^.*contains\('(.*)',Name\).*/gm;
const online = " Online eq true"
const offline = " Online eq false" 

//Utility functions

exports.parseRollingInfo = data => {
  var rollingInfo = {};
  try {
    if (data) {
     
      let unit =  data.KeepPeriodUnit;
      if (data.KeepPeriod === 1) {
        unit = unit.slice(0, -1); 
      }
      let keepPeriod = data.KeepPeriod + ' ' + this.capitalizeFirstLetter(unit);
      let filter = (data.Filter) ? this.parseODataFilter(data.Filter) : "All product types ";
      let rawFilter = (data.Filter) ? data.Filter : "All product types";
      rollingInfo.text = filter + keepPeriod;
      rollingInfo.filter = rawFilter + " " + keepPeriod;
      
    }
  } catch (error) {
		wlogger.error('Error parsing Rolling Info');
		wlogger.error(error);
	}
  return rollingInfo;
};


exports.parseDataSourceInfo = (data, centre) => {
  var dsInfo = {};
  try {
    if (data) {
     
      let lastCreationDate = this.parseJsonDate(data.LastCreationDate);
      let filter = (data.FilterParam) ? this.parseODataFilter(data.FilterParam) : "All product types ";
      let rawFilter = (data.FilterParam) ? data.FilterParam : "All product types";
      dsInfo.info = filter;
      dsInfo.filter = rawFilter + " ";
      dsInfo.lastCreationDate = lastCreationDate;
      if(centre) {
        dsInfo.centre =  centre;
      }
    }
  } catch (error) {
		wlogger.error('Error parsing DataSource Info');
		wlogger.error(error);
	}
  return dsInfo;
};

exports.parseV2DataSourceInfo = (data, refSource, source, centre) => {
  var dsInfo = {};
  try {
    if (data) {

      let lastCreationDate = 'N/A';
      
      if(refSource.LastCreationDate) {
        lastCreationDate = refSource.LastCreationDate;
      } else if (source.LastCreationDate) {
        lastCreationDate = source.LastCreationDate;
      } else {
        lastCreationDate = this.parseJsonDate(data.LastCreationDate);
      }       
      let filter = (data.FilterParam) ? this.parseODataFilter(data.FilterParam) : "All product types ";
      let rawFilter = (data.FilterParam) ? data.FilterParam : "All product types";
      dsInfo.info = filter;
      dsInfo.filter = rawFilter + " ";
      dsInfo.lastCreationDate = lastCreationDate;
      if(centre) {
        dsInfo.centre =  centre;
      }
    }
  } catch (error) {
		wlogger.error('Error parsing DataSource Info');
		wlogger.error(error);
	}
  return dsInfo;
};


exports.capitalizeFirstLetter = string => {
  return string.toLowerCase().charAt(0).toUpperCase() + string.toLowerCase().slice(1);
}

exports.parseODataFilter = str  => {
  let filter = '';
  let res;
  wlogger.debug('Odata filter to parse: ' + str);
  //parse startswith OData filter
  res = this.resolveRegex(regex_startswith, str);
  if (res && res.length > 0) {
    if(res.startsWith('S1') || res.startsWith('S2') || res.startsWith('S3') || res.startsWith('S5P')) {
      filter += res.replace("S", "Sentinel-");

    } else {
      filter += res;
    }      
  }
  res = this.resolveRegex(regex_substring, str);
  if (res && res.length > 0) {
    filter += res;
  }
  res = this.resolveRegex(regex_contains, str);
  if (res && res.length > 0) {
    filter += res;
  }
  if (str.toLowerCase().indexOf(online.toLowerCase()) >= 0) {
    filter += "Online "
  }
  if (str.toLowerCase().indexOf(offline.toLowerCase()) >= 0) {
    filter += "Offline"
  }
  if (filter.length === 0) {
    return str + ' ';
  } else {
    filter = filter.replace(/_/g,' ');
    return filter.replace(/  /g,' ');
  }


}

exports.resolveRegex = (regex,str) => {
  let m;
  let value = '';

  while ((m = regex.exec(str)) !== null) {
      // This is necessary to avoid infinite loops with zero-width matches
      if (m.index === regex.lastIndex) {
          regex.lastIndex++;
      }
      
      // The result can be accessed through the `m`-variable.
      m.forEach((match, groupIndex) => {
        if(groupIndex > 0 ) {
          wlogger.debug(`Found match, group ${groupIndex}: ${match}`);
          value = value + match + ' ';
        }
      });
  }
  return value;
}

exports.parseJsonDate = (jsonDate)  => {
  try {
    var offset = new Date().getTimezoneOffset();
    var parts = /\/Date\((-?\d+)([+-]\d{2})?(\d{2})?.*/.exec(jsonDate);

    if (parts[2] == undefined)
        parts[2] = 0;

    if (parts[3] == undefined)
        parts[3] = 0;

    return new Date(+parts[1] + offset + parts[2] * 3600000 + parts[3] * 60000).toISOString();
  } catch (error) {
    return "N/A";
  }
};

exports.getDatesList = (start, stop)  => {
  let dates =[];
  try {
    
    let currentDate = start;
    const addDays = function (days) {
      const date = new Date(this.valueOf())
      date.setDate(date.getDate() + days)
      return date
    }
    while (currentDate <= stop) {
      dates.push(currentDate.toISOString().split('T')[0])
      currentDate = addDays.call(currentDate, 1)
    }
    
  } catch (error) {
    wlogger.error(error)
  }
  return dates;
};


exports.performDHuSServiceRequest = async (service, requestUrl) => {
  const source = axios.CancelToken.source();
  let requestTimeout = (conf.getConfig().requestTimeout) ? conf.getConfig().requestTimeout : 30000;
  timeout = setTimeout(() => {
    source.cancel();
    wlogger.error("No response received from Service " + service.service_url); 
    wlogger.error("Timeout of "+ requestTimeout +"ms exceeded");
  }, requestTimeout);
  const response = await axios({
    method: 'get',
    url: urljoin(service.service_url, requestUrl),
    auth: {
      username: service.username,
      password: Utilcrypto.decrypt(service.password)
    },
    validateStatus: false,
    cancelToken: source.token
  }).catch(err => {
    if (err.response) {
    // client received an error response (5xx, 4xx)
    wlogger.error("Received error response from Service " + service.service_url); 
    wlogger.error(err);
    } else if (err.request) {
    // client never received a response, or request never left
    wlogger.error("No response received from Service " + service.service_url); 
    wlogger.error(err);
    } else {
    // anything else
    wlogger.error("Error from Service " + service.service_url); 
    wlogger.error(err);
    }
  });
  // Clear The Timeout
  clearTimeout(timeout);
  return response;
}


