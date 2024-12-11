const mysql = require('mysql2');


// MySQL connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '***REMOVED***', 
    database: 'ServiceTechnicianFinder',
  });
  db.connect((err) => {
    if (err) {
      console.error('Error connecting to the database:', err.message);
    } else {
      console.log('Connected to the MySQL database.');
    }
  });
  module.exports = db;