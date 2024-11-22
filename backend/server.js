const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// MySQL connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '***REMOVED***', // Replace with your MySQL password
  database: 'ServiceTechnicianFinder',
});

// JWT Secret Key
const SECRET_KEY = 'your_secret_key';

// User Signup
app.post('/signup', (req, res) => {
  const { user_name, email, password, phone_number, role } = req.body;

  if (!user_name || !email || !password || !role) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }

  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) return res.status(500).json({ success: false, message: 'Error hashing password.' });

    const query = 'INSERT INTO User (user_name, email, password, phone_number, role) VALUES (?, ?, ?, ?, ?)';
    db.query(query, [user_name, email, hashedPassword, phone_number, role], (err) => {
      if (err) return res.status(500).json({ success: false, message: 'Error during sign-up.' });
      res.json({ success: true, message: 'User created successfully!' });
    });
  });
});

// User Login
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  const query = 'SELECT * FROM User WHERE email = ?';
  db.query(query, [email], (err, results) => {
    if (err || results.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid email or password' });
    }

    bcrypt.compare(password, results[0].password, (err, match) => {
      if (err || !match) {
        return res.status(400).json({ success: false, message: 'Invalid email or password' });
      }

      const token = jwt.sign({ user_id: results[0].user_id, role: results[0].role }, SECRET_KEY, {
        expiresIn: '1h',
      });

      res.json({ success: true, message: 'Login successful!', token });
    });
  });
});

// Middleware for authentication
const authenticateJWT = (req, res, next) => {
  const token = req.header('Authorization')?.split(' ')[1];
  if (!token) return res.status(403).json({ success: false, message: 'Access denied.' });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ success: false, message: 'Invalid token.' });
    req.user = user;
    next();
  });
};

// Dashboard Endpoint
app.get('/dashboard', authenticateJWT, (req, res) => {
  res.json({ success: true, message: `Welcome to the dashboard, user ${req.user.user_id}` });
});

// Delete Account
app.delete('/delete-account', authenticateJWT, (req, res) => {
  const userId = req.user.user_id;
  db.query('DELETE FROM User WHERE user_id = ?', [userId], (err) => {
    if (err) return res.status(500).json({ success: false, message: 'Error deleting account.' });
    res.json({ success: true, message: 'Account deleted successfully.' });
  });
});

// Get Cities
app.get('/api/cities', (req, res) => {
  db.query('SELECT city_id, city_name FROM City_location', (err, results) => {
    if (err) return res.status(500).send('Error fetching cities.');
    res.json(results);
  });
});

// Get Areas by City
app.get('/api/areas/:city_id', (req, res) => {
  db.query('SELECT zipcode, area FROM Location WHERE city_id = ?', [req.params.city_id], (err, results) => {
    if (err) return res.status(500).send('Error fetching areas.');
    res.json(results);
  });
});
// Get Technicians by Area (Zipcode)
app.get('/api/technicians/:zipcode', (req, res) => {
  const { zipcode } = req.params;

  const query = `
    SELECT 
      Technician.user_id,
      User.user_name,
      Technician.experienced_year,
      Location.area,
      GROUP_CONCAT(Service.service_name) AS services
    FROM Technician
    JOIN User ON Technician.user_id = User.user_id
    JOIN Location ON Technician.zipcode = Location.zipcode
    LEFT JOIN Offers ON Technician.user_id = Offers.technician_id
    LEFT JOIN Service ON Offers.service_id = Service.service_id
    WHERE Technician.zipcode = ?
    GROUP BY Technician.user_id
  `;

  db.query(query, [zipcode], (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Error fetching technicians.', error: err });
    }
    res.json({ success: true, technicians: results });
  });
});


// Server setup
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
