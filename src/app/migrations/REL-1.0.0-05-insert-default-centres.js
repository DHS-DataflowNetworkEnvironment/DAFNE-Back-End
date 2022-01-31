'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.bulkInsert('centres', [
        { name: 'Austria ZAMG', description: 'https://vsentdhr.zamg.ac.at', latitude: 48.24928358852469, longitude: 16.355753363915035, color:  '#69995D'},
        { name: 'Austria EODC', description: 'https://dhr.datahub.eodc.eu', latitude: 48.179903165085726, longitude: 16.395971500000005, color:  '#4381C1'},
        { name: 'Czech Republic CESNET', description: 'https://fe1.dhr.cesnet.cz', latitude: 50.10193527772726, longitude: 14.390744768732873, color:  '#F5D547'},
        { name: 'Greece NOA', description: 'https://dhr.copernicus.grnet.gr', latitude: 37.973519181951524, longitude: 23.718187898956536, color:  '#D3F3EE'},
        { name: 'Norway MET', description: 'https://sentinelhub2.met.no/#/home', latitude: 59.94281367695617, longitude: 10.720705571080295, color:  '#744253'},
        { name: 'UK Airbus', description: 'https://ukdhr.co.uk', latitude: 53.17458069262196, longitude: -2.9758704328325587, color:  '#FF8966'},
        { name: 'UK STFC', description: 'https://srh-services8.ceda.ac.uk', latitude: 53.38512864018618, longitude: -2.6255716974652046, color:  '#DB5461'}
    ]),

    down: (queryInterface, Sequelize) => queryInterface.bulkDelete('centres', {name: 
        {[Sequelize.Op.in]: ['Austria ZAMG', 'Austria EODC', 'Czech Republic CESNET', 'Greece NOA', 'Norway MET', 'UK Airbus', 'UK STFC']}}, {})
};
