const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { SECRET_KEY, expiresIn } = require('../config/jwtConfig');


// login 
const login = (req, res) => {  const { email, password } = req.body;
const query = 'SELECT * FROM User WHERE email = ?';

db.query(query, [email], (err, results) => {
  if (err || results.length === 0) {
    return res.status(400).json({ success: false, message: 'Invalid email or password' });
  }

  const user = results[0];

  bcrypt.compare(password, user.password, (err, match) => {
    if (err || !match) {
      return res.status(400).json({ success: false, message: 'Invalid email or password' });
    }

    const token = jwt.sign({ user_id: user.user_id, role: user.role }, SECRET_KEY, { expiresIn: '1h' });

   
    const updateQuery = 'UPDATE Customer SET last_login = NOW() WHERE user_id = ?';
    db.query(updateQuery, [user.user_id], (updateErr) => {
      if (updateErr) {
        console.error('Error updating last login:', updateErr);
      }
    });

    res.json({
      success: true,
      message: 'Login successful!',
      token,
      role: user.role
    });
  });
});
 };

// Reset Password logic here...
const resetPassword = (req, res) => {
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

 };

// Signup logic here...
const signup =     (req, res) => {
    const { user_name, email, password, phone_number, role } = req.body;
  
  
    if (!user_name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }
  
    
    bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err) return res.status(500).json({ success: false, message: 'Error hashing password.' });
  
      const userQuery = 'INSERT INTO User (user_name, email, password, phone_number, role) VALUES (?, ?, ?, ?, ?)';
      db.query(userQuery, [user_name, email, hashedPassword, phone_number, role], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Error during sign-up.' });
       
          const userId = results.insertId; 
          const customerQuery = 'INSERT INTO Customer (user_id) VALUES (?)';
          db.query(customerQuery, [userId], (err) => {
            if (err) return res.status(500).json({ success: false, message: 'Error creating customer record.' });
            return res.json({ success: true, message: 'Customer created successfully!' });
          });
      });
    });
};
 const deleteAccount = (req, res) => { 
  const userId = req.user.user_id;
  db.query('DELETE FROM User WHERE user_id = ?', [userId], (err) => {
    if (err) return res.status(500).json({ success: false, message: 'Error deleting account.' });
    res.json({ success: true, message: 'Account deleted successfully.' });
  });
  };

module.exports = {signup, login,resetPassword,deleteAccount};



