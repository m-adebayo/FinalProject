const mysql = require('mysql2');
require('dotenv').config();

// Lets multiple requests share DB connections instead of opening a new one every time 
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,      // max 10 open connections at once
    connectTimeout: 30000,    // give up after 30s if DB isn't reachable
});

module.exports = pool.promise();
