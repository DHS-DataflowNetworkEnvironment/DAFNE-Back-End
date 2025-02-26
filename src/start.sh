export NODE_ENV=production

export CONF_PATH=../config/
export LOGS_PATH=../logs/

bash -c "npx sequelize-cli db:migrate && node index.js"