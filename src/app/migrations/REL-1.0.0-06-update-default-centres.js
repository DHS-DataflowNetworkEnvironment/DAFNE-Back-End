'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.sequelize.query("UPDATE centres SET description='https://sentinelhub2.met.no' where description like 'https://sentinelhub2.met.no%'"),

    down: (queryInterface, Sequelize) => queryInterface.sequelize.query("UPDATE centres SET description='https://sentinelhub2.met.no/#/home' where description like 'https://sentinelhub2.met.no%'")
};
