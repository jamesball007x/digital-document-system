const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const mysql = require('mysql2/promise');

let pool = null;

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'docms_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
};

async function getPool() {
  if (!pool) {
    const { initDB } = require('../services/dbInitService');
    await initDB();
  }
  return pool;
}

function setPool(p) {
  pool = p;
}

async function query(sql, params = []) {
  const p = await getPool();
  const [rows] = await p.query(sql, params);
  return rows;
}

async function execute(sql, params = []) {
  const p = await getPool();
  const [result] = await p.execute(sql, params);
  return result;
}

module.exports = {
  dbConfig,
  getPool,
  setPool,
  query,
  execute
};
