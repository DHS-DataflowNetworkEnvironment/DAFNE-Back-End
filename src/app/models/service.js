const Sequelize = require('sequelize');
const db = require('app/util/database');

const Service = db.define('Service', {
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
    token_url: {
        type: Sequelize.STRING,
        allowNull: true,
        unique: false
    },
    client_id: {
        type: Sequelize.STRING,
        allowNull: true,
        unique: false
    },
    service_type: {
      type: Sequelize.INTEGER,
      allowNull: false
    },
    centre: {
        type: Sequelize.INTEGER,
        allowNull: false,
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
        hooks: true,
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
}, {
	tableName: 'services'
}, {
	indexes:[{
		unique: true,
		fields: ['id']
	},{
		unique: false,
		fields: ['username']
	},{
		unique: false,
		fields: ['centre']
	},{
		unique: false,
		fields: ['service_type']
	}]
});
  
  Service.associate = function(models) {
    Service.belongsTo(models.centre, {
        foreignKey: 'centre',
        as: 'centre',
        onDelete: 'CASCADE',
        hooks: true
      });
  
  };
  Service.schema("public");

module.exports = Service;
