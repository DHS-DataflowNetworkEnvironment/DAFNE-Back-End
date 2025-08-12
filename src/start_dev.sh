export NODE_ENV=development

export CONF_PATH=/workspaces/DAFNE-Back-End-EVO/config/
export LOGS_PATH=/workspaces/DAFNE-Back-End-EVO/logs/

bash -c "npx sequelize-cli db:migrate && npm start"