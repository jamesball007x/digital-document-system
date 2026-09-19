const dbConfigModule = require('./src/config/db');
const dbInitModule = require('./src/services/dbInitService');

module.exports = {
  dbConfig: dbConfigModule.dbConfig,
  getPool: dbConfigModule.getPool,
  query: dbConfigModule.query,
  execute: dbConfigModule.execute,
  initDB: dbInitModule.initDB
};
