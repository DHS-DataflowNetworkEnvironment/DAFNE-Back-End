'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.bulkInsert('service_types', [
        { id: 4, service_type: 'DAS', createdAt: new Date(), updatedAt: new Date() },
        { id: 5, service_type: 'PRIP', createdAt: new Date(), updatedAt: new Date() },
        { id: 6, service_type: 'LTA', createdAt: new Date(), updatedAt: new Date() }
    ]),

    down: (queryInterface, Sequelize) => queryInterface.bulkDelete('service_types', {id: {[Op.in]: [4, 5, 6]}}, {})
};