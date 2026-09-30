'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('publication_timeliness', {
      id: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true
      },
      timestamp: {
        type: Sequelize.DATE,
        allowNull: false
      },
      centre_id: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      local_url: {
        type: Sequelize.STRING,
        allowNull: false
      },
      filter_label: {
        type: Sequelize.STRING,
        allowNull: false
      },
      filter: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      source_url: {
        type: Sequelize.STRING,
        allowNull: false
      },
      product_name: {
        type: Sequelize.STRING,
        allowNull: true
      },
      product_id: {
        type: Sequelize.STRING,
        allowNull: true
      },
      publication_date_local: {
        type: Sequelize.DATE,
        allowNull: true
      },
      publication_date_source: {
        type: Sequelize.DATE,
        allowNull: true
      },
      timeliness: {
        type: Sequelize.BIGINT,
        allowNull: true
      },
      retry: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 1
      },
      description: {
        type: Sequelize.TEXT,
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
    })
    .then(() => queryInterface.addIndex('publication_timeliness', ['timeliness']))
    .then(() => queryInterface.addIndex('publication_timeliness', ['source_url']))
    .then(() => queryInterface.addIndex('publication_timeliness', ['timestamp']))
    .then(() => queryInterface.addIndex('publication_timeliness', ['filter_label']))
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('publication_timeliness');
  }
};
