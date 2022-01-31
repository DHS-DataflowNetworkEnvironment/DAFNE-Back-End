'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.bulkInsert('service_types', [
        { id: 1, service_type: 'DHuS Single Instance', createdAt: new Date(), updatedAt: new Date() },
        { id: 2, service_type: 'DHuS Front-End', createdAt: new Date(), updatedAt: new Date() },
        { id: 3, service_type: 'DHuS Back-End', createdAt: new Date(), updatedAt: new Date() }
    ]),

    down: (queryInterface, Sequelize) => queryInterface.bulkDelete('service_types', null, {})
};