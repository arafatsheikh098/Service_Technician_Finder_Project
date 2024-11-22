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
// Reset Password
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
      GROUP_CONCAT(Service.service_name) AS services,
      User.phone_number
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

app.put('/api/update-profile', authenticateJWT, (req, res) => {
  const { user_name, email, phone_number } = req.body;

  // Validate request body
  if (!user_name || !email || !phone_number) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }

  // Check if email already exists for another user (excluding the current user)
  const checkEmailQuery = 'SELECT * FROM User WHERE LOWER(email) = LOWER(?) AND user_id != ?';
  db.query(checkEmailQuery, [email, req.user.user_id], (err, results) => {
    if (err) {
      console.error('Error checking email:', err);  // Log the error
      return res.status(500).json({ success: false, message: 'Database error.' });
    }

    // If email already exists for another user
    if (results.length > 0) {
      return res.status(400).json({ success: false, message: 'Email already in use.' });
    }

    // Proceed with the profile update
    const query = `
      UPDATE User
      SET user_name = ?, email = ?, phone_number = ?
      WHERE user_id = ?
    `;
    db.query(query, [user_name, email, phone_number, req.user.user_id], (err, result) => {
      if (err) {
        console.error('Error updating profile:', err);  // Log the error
        return res.status(500).json({ success: false, message: 'Error updating profile.' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }

      res.json({ success: true, message: 'Profile updated successfully!' });
    });
  });
});
app.get('/api/technician-details/:technician_id', (req, res) => {
  const technicianId = req.params.technician_id;

  const query = `
    SELECT 
      Technician.experienced_year, 
      AVG(Booking.rating) AS rating, 
      COUNT(Booking.booking_id) AS booking_count, 
      COUNT(DISTINCT Booking.booking_id) AS reviews_count
    FROM Technician
    LEFT JOIN Booking ON Technician.user_id = Booking.technician_id
    WHERE Technician.user_id = ?
    GROUP BY Technician.user_id
  `;

  db.query(query, [technicianId], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Error fetching technician details.' });

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'Technician not found.' });
    }

    const technicianDetails = results[0];
    res.json({
      success: true,
      technicianDetails,
    });
  });
});


// Create Booking (Customer books a Technician)
app.post('/api/bookings', authenticateJWT, (req, res) => {
  const { technician_id, booking_date, status } = req.body;
  const customer_id = req.user.user_id;

  const query = 'INSERT INTO Booking (customer_id, technician_id, booking_date, status) VALUES (?, ?, ?, ?)';
  db.query(query, [customer_id, technician_id, booking_date, status], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Error creating booking.' });
    res.json({ success: true, message: 'Booking created successfully!', booking_id: results.insertId });  
  });
});

// Update Booking Status to Completed and Add Rating/Review
app.put('/api/bookings/:booking_id', authenticateJWT, (req, res) => {
  const { booking_id } = req.params;
  const { status, rating, review } = req.body;

  if (status === 'Completed' && (rating === undefined || review === undefined)) {
    return res.status(400).json({ success: false, message: 'Rating and review are required when completing the booking.' });
  }

  const query = `
    UPDATE Booking
    SET status = ?, rating = ?, review = ?
    WHERE booking_id = ? AND customer_id = ?
  `;

  db.query(query, [status, rating, review, booking_id, req.user.user_id], (err) => {
    if (err) return res.status(500).json({ success: false, message: 'Error updating booking.' });
    res.json({ success: true, message: 'Booking status updated successfully!' });
  });
});

// Get Customer Details
app.get('/api/customer-details', authenticateJWT, (req, res) => {
  const userId = req.user.user_id;

  const query = `
    SELECT user_name, phone_number, email
    FROM User
    WHERE user_id = ?
  `;
  
  db.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Error fetching customer details.' });
    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }
    res.json(results[0]);  // Send back the customer details
  });
});

// Get Bookings for the Logged-in User
app.get('/api/bookings', authenticateJWT, (req, res) => {
  const userId = req.user.user_id;

  const query = `
    SELECT 
      Booking.booking_id,
      Booking.booking_date,
      Technician.user_name AS technician_name,
      Booking.status,
      Booking.rating,
      Booking.review
    FROM Booking
    JOIN Technician ON Booking.technician_id = Technician.user_id
    WHERE Booking.customer_id = ?
    ORDER BY Booking.booking_date DESC
  `;

  db.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Error fetching bookings.' });
    res.json(results);  // Send back the list of bookings for the user
  });
});


// Start Server
const port = 8000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
