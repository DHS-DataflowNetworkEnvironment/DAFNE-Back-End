const Sequelize = require('sequelize');
const db = require('../util/database');

const ServiceAvailability = db.define('service_availability', {
	id: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true
      },
      service_url: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'services',
          key: 'service_url'
        }
      },
      centre_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'centres',
          key: 'id'
        }
      },
      timestamp: {
        type: Sequelize.DATE,
        allowNull: false
      },
      http_request: {
        type: Sequelize.STRING,
        allowNull: false
      },
      http_status_code: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      http_response_time: {
        type: Sequelize.BIGINT,
        allowNull: true
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
	tableName: 'service_availability'
}, {
	indexes:[{
		unique: false,
		fields: ['timestamp']
	},{
		unique: false,
		fields: ['http_status_code']
	}]
});
  
ServiceAvailability.associate = function(models) {
    ServiceAvailability.belongsTo(models.Service, {
        foreignKey: 'service_url',
        as: 'service_url'
    });

};
ServiceAvailability.associate = function(models) {
    ServiceAvailability.belongsTo(models.Centre, {
        foreignKey: 'centre_id',
        as: 'centre_id'
    });
  
};
ServiceAvailability.schema("public");

module.exports = ServiceAvailability;
