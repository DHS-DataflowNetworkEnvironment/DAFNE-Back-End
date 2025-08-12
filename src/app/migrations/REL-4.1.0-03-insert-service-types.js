'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.bulkInsert('service_types', [
        { id: 1, service_type: 'DHuS Single Instance', supports_oauth2: false, createdAt: new Date(), updatedAt: new Date() },
        { id: 2, service_type: 'DHuS Front-End', supports_oauth2: false, createdAt: new Date(), updatedAt: new Date() },
        { id: 3, service_type: 'DHuS Back-End', supports_oauth2: false, createdAt: new Date(), updatedAt: new Date() },
        { id: 4, service_type: 'CDSE', supports_oauth2: false, createdAt: new Date(), updatedAt: new Date() },
        { id: 5, service_type: 'CDSE OAuth2', supports_oauth2: true, createdAt: new Date(), updatedAt: new Date() },
        { id: 6, service_type: 'PRIP', supports_oauth2: true, createdAt: new Date(), updatedAt: new Date() },
        { id: 7, service_type: 'LTA', supports_oauth2: false, createdAt: new Date(), updatedAt: new Date() },
        { id: 8, service_type: 'GSS', supports_oauth2: true, createdAt: new Date(), updatedAt: new Date() }
    ]),

    down: (queryInterface, Sequelize) => queryInterface.bulkDelete('service_types', null, {})
};