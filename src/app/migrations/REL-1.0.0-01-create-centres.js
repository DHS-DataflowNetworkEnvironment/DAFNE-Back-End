'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('centres', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      description: {
        type: Sequelize.STRING,
        allowNull: true
      },
      latitude: {
        type: Sequelize.DOUBLE,
        allowNull: false,
        defaultValue: 0.0
      },
      longitude: {
        type: Sequelize.DOUBLE,
        allowNull: false,
        defaultValue: 0.0
      },
      local: {
        type: Sequelize.BOOLEAN,
        allowNull: true,
        unique: true
      },
      icon: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: "place"
      },
      color: {
        type: Sequelize.STRING,
        allowNull: true
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
    }).then(() => queryInterface.addIndex('centres', ['id']))
    .then(() => queryInterface.addIndex('centres', ['name']))
    .then(() => queryInterface.addIndex('centres', ['local']))
    .then(() => queryInterface.addConstraint('centres', ['local'], {
      type: 'check',
      where: {
        local: true
      }
    }));
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('centres');
  }
};
