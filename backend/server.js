const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Create a MySQL connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '***REMOVED***', // Replace with your MySQL password
  database: 'ServiceTechnicianFinder',
});

// JWT Secret Key (Use environment variables in production)
const SECRET_KEY = 'your_secret_key';

// User Sign-Up route
app.post('/signup', (req, res) => {
  const { user_name, email, password, phone_number, role } = req.body;

  if (!user_name || !email || !password || !role) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }

  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Error during password hashing.' });
    }

    const query = 'INSERT INTO User (user_name, email, password, phone_number, role) VALUES (?, ?, ?, ?, ?)';
    db.query(query, [user_name, email, hashedPassword, phone_number, role], (err, results) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Error during sign-up. Please try again.' });
      }
      res.json({ success: true, message: 'User created successfully!' });
    });
  });
});

// User Log-In route
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required' });
  }

  const query = 'SELECT * FROM User WHERE email = ?';
  db.query(query, [email], (err, results) => {
    if (err || results.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid email or password' });
    }

    bcrypt.compare(password, results[0].password, (err, match) => {
      if (err || !match) {
        return res.status(400).json({ success: false, message: 'Invalid email or password' });
      }

      // Generate JWT token
      const token = jwt.sign({ user_id: results[0].user_id, role: results[0].role }, SECRET_KEY, {
        expiresIn: '1h',
      });

      res.json({
        success: true,
        message: 'Login successful!',
        token: token,
      });
    });
  });
});

// Middleware to authenticate JWT
const authenticateJWT = (req, res, next) => {
  const token = req.header('Authorization')?.split(' ')[1]; // Expect "Bearer <token>"

  if (!token) {
    return res.status(403).json({ success: false, message: 'Access denied. No token provided.' });
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid token.' });
    }

    req.user = user; // Attach user info to request
    next();
  });
};

app.post('/reset-password', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  const query = 'SELECT * FROM User WHERE email = ?';
  db.query(query, [email], (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database query error.' });
    }
    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'This email is not registered yet.' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const updateQuery = 'UPDATE User SET password = ? WHERE email = ?';
    db.query(updateQuery, [hashedPassword, email], (err) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Error updating password.' });
      }
      res.json({ success: true, message: 'Password has been reset successfully.' });
    });
  });
});

app.delete('/delete-account', authenticateJWT, (req, res) => {
  const userId = req.user.user_id; // Assuming the token contains the user_id
  const query = 'DELETE FROM User WHERE user_id = ?';
  db.query(query, [userId], (err, result) => {
    if (err) {
      console.error('Error during account deletion:', err);
      return res.status(500).json({ success: false, message: 'Failed to delete account.' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    res.json({ success: true, message: 'Account deleted successfully.' });
  });
});




// Protected Route Example (Dashboard)
app.get('/dashboard', authenticateJWT, (req, res) => {
  res.json({ success: true, message: `Welcome to the dashboard, user ${req.user.user_id}` });
});


// Server setup
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
