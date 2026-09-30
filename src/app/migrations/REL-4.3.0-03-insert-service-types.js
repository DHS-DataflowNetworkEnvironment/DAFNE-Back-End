'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.bulkInsert('service_types', [
        { id: 4, service_type: 'CDSE', supports_oauth2: false, createdAt: new Date(), updatedAt: new Date() },
        { id: 8, service_type: 'GSS', supports_oauth2: true, createdAt: new Date(), updatedAt: new Date() }
    ]),

    down: (queryInterface, Sequelize) => queryInterface.bulkDelete('service_types', null, {})
};