'use strict';
module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.bulkUpdate(
            'service_types',
            { service_type: 'CDSE' },
            { id: 4 }
        );
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.bulkUpdate(
            'service_types',
            { service_type: 'DAS' },
            { id: 4 }
        );
    }
};
