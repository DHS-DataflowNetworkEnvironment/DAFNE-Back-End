'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('services', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true
      },
      username: {
        type: Sequelize.STRING,
        allowNull: false
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false
      },
      service_url: {
        type: Sequelize.STRING,
        allowNull: false,
		    unique: true
      },
      service_type: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'service_types',
          key: 'id'
        }
      },
      centre: {
        type: Sequelize.INTEGER,
        allowNull: false,
        onDelete: 'CASCADE',
        references: {
          model: 'centres',
          key: 'id'
        }
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Date.now()
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Date.now()
      }
    }).then(() => queryInterface.addIndex('services', ['id']))
        .then(() => queryInterface.addIndex('services', ['username']))
        .then(() => queryInterface.addIndex('services', ['service_type']))
        .then(() => queryInterface.addIndex('services', ['centre']));
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('services');
  }
};
