const mysql = require('mysql2');

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root', // Your MySQL username
    password: '***REMOVED***', // Your MySQL password
    database: 'ServiceTechnicianFinder',
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to database:', err);
    } else {
        console.log('Connected to the MySQL database');
    }
});

module.exports = db;
