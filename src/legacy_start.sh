export NODE_ENV=production

export CONF_PATH=/data/dafne/back-end/config/
export LOGS_PATH=/data/dafne/back-end/logs/

bash -c "npx sequelize-cli db:migrate && node index.js"
