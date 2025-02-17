'use strict';
module.exports = {
    async up(queryInterface, Sequelize) {
      await queryInterface.addColumn(
        'service_types',
        'supports_oauth2',
        {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        }
      );

      // Fetch all records from "service-types"
      const serviceTypes = await queryInterface.sequelize.query(
        `SELECT id, supports_oauth2 FROM "service_types";`,
        { type: Sequelize.QueryTypes.SELECT }
      );
  
      // Update each record (customize logic if needed)
      for (const serviceType of serviceTypes) {
        await queryInterface.sequelize.query(
          `UPDATE "service_types" SET "supports_oauth2" = :value WHERE id = :id;`,
          {
            replacements: { id: serviceType.id, value: ((serviceType.id === 4 || serviceType.id === 5 || serviceType.id === 7) ? true : false) }, // Adjust logic as needed
          }
        );
      }
    },
    async down(queryInterface, Sequelize) {
      await queryInterface.removeColumn(
        'service_types', 'supports_oauth2'
      );
    }
  };