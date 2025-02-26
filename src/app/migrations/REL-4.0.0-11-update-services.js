'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn(
        'services',
        'token_url',
        {
          type: Sequelize.STRING,
          allowNull: true
        }
      ),
      queryInterface.addColumn(
        'services',
        'client_id',
        {
          type: Sequelize.STRING,
          allowNull: true
        }
      )
    ]);
  },
  down: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeColumn(
        'services', 'token_url'
      ),
      queryInterface.removeColumn(
        'services', 'client_id'
      )
    ]);
  }
};
