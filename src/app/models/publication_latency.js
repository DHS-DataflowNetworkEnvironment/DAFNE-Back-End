const Sequelize = require('sequelize');
const db = require('../util/database');

const PublicationLatency = db.define('publication_latency', {
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
  backend_url: {
    type: Sequelize.STRING,
    allowNull: false
  },
  frontend_url: {
    type: Sequelize.STRING,
    allowNull: true
  },
  centre_id: {
    type: Sequelize.INTEGER,
    allowNull: false
  },
  synch_id: {
    type: Sequelize.INTEGER,
    allowNull: false
  },
  synch_label: {
    type: Sequelize.STRING,
    allowNull: false
  },
  synch_filter: {
    type: Sequelize.STRING,
    allowNull: true
  },
  synch_geo_filter: {
    type: Sequelize.STRING,
    allowNull: true
  },
  source_url: {
    type: Sequelize.STRING,
    allowNull: false
  },
  source_last_creation_date: {
    type: Sequelize.DATE,
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
  creation_date_be: {
    type: Sequelize.DATE,
    allowNull: true
  },
  creation_date_fe: {
    type: Sequelize.DATE,
    allowNull: true
  },
  creation_date_source: {
    type: Sequelize.DATE,
    allowNull: true
  },
  latency_be: {
    type: Sequelize.BIGINT,
    allowNull: true
  },
  latency_fe: {
    type: Sequelize.BIGINT,
    allowNull: true
  },
  retry: {
    type: Sequelize.INTEGER,
    allowNull: true,
    defaultValue: 1
  },
  description: {
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
}, {
	tableName: 'publication_latency'
}, {
	indexes:[{
		unique: false,
		fields: ['timestamp']
	},{
		unique: false,
		fields: ['latency_fe']
	},{
		unique: false,
		fields: ['latency_be']
	},{
		unique: false,
		fields: ['synch_id']
	},{
		unique: false,
		fields: ['synch_label']
	}]
});
  

PublicationLatency.schema("public");

module.exports = PublicationLatency;
