'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.bulkInsert('centres', [
        { name: 'CDA', description: 'https://cda.copernicus.eu', latitude: 41.8480328451355, longitude: 12.608188065770385, color:  '#69995D'},
        { name: 'CDSE', description: 'https://catalogue.dataspace.copernicus.eu', latitude: 52.22453523386313, longitude: 21.04036324826786, color:  '#4381C1'},
        { name: 'CESNET', description: 'https://fe1.dhr.cesnet.cz', latitude: 50.099029868699866, longitude: 14.388604607701426, color:  '#F5D547'},
        { name: 'DHR_GR', description: 'https://dhr.copernicus.grnet.gr', latitude: 38.09613674027445, longitude: 23.824488623423576, color:  '#D3F3EE'},
        { name: 'NO_MET', description: 'https://www.norgehub.met.no', latitude: 59.94281367695617, longitude: 10.720705571080295, color:  '#744253'},
        { name: 'UK AIRBUS', description: 'https://ukdhr.co.uk', latitude: 53.17458069262196, longitude: -2.9758704328325587, color:  '#FF8966'},
        { name: 'UK STFC', description: 'https://srh-services21.ceda.ac.uk', latitude: 53.34468455105028, longitude: -2.6399106185760743, color:  '#DB5461'}
    ]),

    down: (queryInterface, Sequelize) => queryInterface.bulkDelete('centres', {name: 
        {[Sequelize.Op.in]: ['Austria ZAMG', 'Austria EODC', 'Czech Republic CESNET', 'Greece NOA', 'Norway MET', 'UK Airbus', 'UK STFC']}}, {})
};