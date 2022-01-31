const Sequelize = require('sequelize');
const db = require('../util/database');

const Service_Type= db.define('service_type', {
	id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  service_type: {
    type: Sequelize.STRING,
    allowNull: false,
    unique: true
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
	tableName: 'service_types'
}, {
	indexes:[{
		unique: true,
		fields: ['id']
	}]
});
  
  
Service_Type.schema("public");

module.exports = Service_Type;
