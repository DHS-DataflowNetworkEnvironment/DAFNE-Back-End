'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn(
      'services',
      'token_url',
      {
        type: Sequelize.STRING,
        allowNull: true
      }
    );
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn(
      'services', 'token_url'
    );
  }
};
