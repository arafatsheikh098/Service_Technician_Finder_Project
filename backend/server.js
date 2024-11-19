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

// MySQL connection setup
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '***REMOVED***',
  database: 'ServiceTechnicianFinder',
});

const SECRET_KEY = 'your_secret_key';

// Forgot password route
app.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  const query = 'SELECT * FROM User WHERE email = ?';
  db.query(query, [email], async (err, results) => {
    if (err || results.length === 0) {
      return res.status(400).json({ success: false, message: 'Email not found.' });
    }

    const user = results[0];
    const resetCode = crypto.randomBytes(3).toString('hex'); // Generate a code
    user.resetCode = resetCode;

    // Save the reset code in the database (consider adding expiration time)
    const updateQuery = 'UPDATE User SET resetCode = ? WHERE email = ?';
    db.query(updateQuery, [resetCode, email], (updateErr) => {
      if (updateErr) {
        return res.status(500).json({ success: false, message: 'Error updating reset code.' });
      }

      // Send reset code via email
      const transporter = nodemailer.createTransport({
        service: 'gmail', // or your email service
        auth: {
          user: 'your-email@example.com',
          pass: 'your-email-password',
        },
      });

      transporter.sendMail({
        from: 'arafat.csecu@gmail.com',
        to: email,
        subject: 'Password Reset Code',
        text: `Your password reset code is: ${resetCode}`,
      }, (emailErr) => {
        if (emailErr) {
          return res.status(500).json({ success: false, message: 'Error sending reset email.' });
        }
        res.json({ success: true, message: 'Reset code sent to email.' });
      });
    });
  });
});

// Update password route
app.post('/reset-password', async (req, res) => {
  const { email, code, newPassword } = req.body;

  const query = 'SELECT * FROM User WHERE email = ? AND resetCode = ?';
  db.query(query, [email, code], async (err, results) => {
    if (err || results.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid code or email.' });
    }

    const user = results[0];
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updateQuery = 'UPDATE User SET password = ?, resetCode = NULL WHERE email = ?';
    db.query(updateQuery, [hashedPassword, email], (updateErr) => {
      if (updateErr) {
        return res.status(500).json({ success: false, message: 'Error resetting password.' });
      }
      res.json({ success: true, message: 'Password reset successfully.' });
    });
  });
});

// Server setup
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
