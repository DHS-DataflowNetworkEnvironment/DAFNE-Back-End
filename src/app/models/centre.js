const Sequelize = require('sequelize');
const db = require('../util/database');

const Centre = db.define('Centre', {
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
        unique: {
          args: true,
          msg: 'Only one local centre is allowed'
        },
        allowNull: true
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
}, {
	tableName: 'centres'
}, {
	indexes:[{
		unique: true,
		fields: ['id']
	},{
    unique: true,
		fields: ['name']
	},{
    fields: ['local']
	}]
});
  
Centre.associate = function(models) {
  Centre.hasMany(models.service, {
      foreignKey: 'centre',
      as: 'centre',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
			hooks: true
    });

};  

Centre.schema("public");

module.exports = Centre;
