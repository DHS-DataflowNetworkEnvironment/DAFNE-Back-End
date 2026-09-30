const Sequelize = require('sequelize');
const db = require('app/util/database');

const PublicationTimeliness = db.define('publication_timeliness', {
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
}, {
	tableName: 'publication_timeliness'
}, {
	indexes:[{
		unique: false,
		fields: ['timestamp']
	},{
		unique: false,
		fields: ['timeliness']
	},{
		unique: false,
		fields: ['source_url']
	},{
		unique: false,
		fields: ['filter_label']
	}]
});
  

PublicationTimeliness.schema("public");

module.exports = PublicationTimeliness;
