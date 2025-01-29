'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.bulkInsert('service_types', [
        { id: 7, service_type: 'GSS', createdAt: new Date(), updatedAt: new Date() }
    ]),

    down: (queryInterface, Sequelize) => queryInterface.bulkDelete('service_types', {id: {[Op.in]: [7]}}, {})
};