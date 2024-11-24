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


app.post('/login', (req, res) => {
  const { email, password } = req.body;
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

      res.json({
        success: true,
        message: 'Login successful!',
        token,
        role: user.role
      });
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
const authenticateJWTWithRole = (allowedRoles) => (req, res, next) => {
  const token = req.header('Authorization')?.split(' ')[1];
  if (!token) return res.status(403).json({ success: false, message: 'Access denied.' });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ success: false, message: 'Invalid token.' });

    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions.' });
    }

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
  res.json({
    success: true,
    message: `Welcome to the dashboard, user ${req.user.user_id}`,
    role: req.user.role, // Add role to response
  });
});
// Technician Dashboard Endpoint
app.get('/technician-dashboard', authenticateJWT, (req, res) => {
  // Check if the user's role is 'technician'
  if (req.user.role !== 'Technician') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Only technicians can access this dashboard.',
    });
  }

  res.json({
    success: true,
    message: `Welcome to the Technician Dashboard, Technician ID: ${req.user.user_id}`,
    role: req.user.role, // Include role for clarity
  });
});
//technician-details
app.get('/technician-details', authenticateJWT, (req, res) => {
  const technicianId = req.user.user_id;
  console.log("Fetching details for technician ID:", technicianId); // Debugging log

  const query = `
    SELECT 
      User.user_name, 
      User.phone_number, 
      User.email, 
      Technician.experienced_year, 
      (SELECT AVG(Booking.rating) FROM Booking WHERE technician_id = ?) AS rating
    FROM User
    JOIN Technician ON User.user_id = Technician.user_id
    WHERE User.user_id = ?
  `;

  db.query(query, [technicianId, technicianId], (err, results) => {
    if (err) {
      console.error('Error fetching technician details:', err); // Log the error for debugging
      return res.status(500).json({ success: false, message: 'Error fetching technician details.' });
    }

    console.log("Technician details:", results); // Log the query result for debugging

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'Technician not found.' });
    }

    res.json({ technicianDetails: results[0] });
  });
});


// Get pending bookings
app.get('/pending-bookings', authenticateJWT, (req, res) => {
  const technicianId = req.user.user_id;

  const query = `
    SELECT 
      Booking.booking_id, 
      Booking.booking_date, 
      Booking.status, 
      User.user_name AS customer_name,
      User.phone_number AS customer_phone_number
    FROM Booking
    JOIN User ON Booking.customer_id = User.user_id
    WHERE Booking.technician_id = ? AND Booking.status = 'Pending'
  `;

  db.query(query, [technicianId], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Error fetching pending bookings.' });
    res.json({ pendingBookings: results });
  });
});

// Get booking history (completed bookings)
app.get('/booking-history', authenticateJWT, (req, res) => {
  const technicianId = req.user.user_id;

  const query = `
    SELECT 
      Booking.booking_id, 
      Booking.booking_date, 
      Booking.status, 
      Booking.rating, 
      Booking.review, 
      User.user_name AS customer_name,
      User.phone_number AS customer_phone_number
    FROM Booking
    JOIN User ON Booking.customer_id = User.user_id
    WHERE Booking.technician_id = ? AND Booking.status = 'Completed'
  `;

  db.query(query, [technicianId], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Error fetching booking history.' });
    res.json({ bookingHistory: results });
  });
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
// PUT route to update customer profile
app.put('/api/customer-details', authenticateJWT, (req, res) => {
  const { user_name, email, phone_number } = req.body;
  const userId = req.user.user_id; // Get the user_id from the JWT token

  // Validate the request body
  if (!user_name || !email || !phone_number) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }

  // If the email is not changed, skip the uniqueness check
  if (email === req.user.email) {
    updateProfile();
  } else {
    // Check if the email is already taken by another user
    const checkEmailQuery = 'SELECT * FROM User WHERE LOWER(email) = LOWER(?) AND user_id != ?';
    db.query(checkEmailQuery, [email, userId], (err, results) => {
      if (err) {
        console.error('Error checking email:', err);
        return res.status(500).json({ success: false, message: 'Database error while checking email.' });
      }

      if (results.length > 0) {
        return res.status(400).json({ success: false, message: 'Email already in use by another user.' });
      }

      // Proceed with the profile update
      updateProfile();
    });
  }

  // Function to update the profile
  function updateProfile() {
    const query = `
      UPDATE User
      SET user_name = ?, email = ?, phone_number = ?
      WHERE user_id = ?
    `;
    db.query(query, [user_name, email, phone_number, userId], (err, result) => {
      if (err) {
        console.error('Error updating profile:', err);
        return res.status(500).json({ success: false, message: 'Error updating profile.' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }

      res.json({ success: true, message: 'Profile updated successfully!' });
    });
  }
});

app.get('/api/technician-details/:technician_id', authenticateJWT, (req, res) => {
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
    if (err) {
      console.error('Error fetching technician details:', err);
      return res.status(500).json({ success: false, message: 'Error fetching technician details.' });
    }
    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'Technician not found.' });
    }

    // Log the results to check the data returned from the database
    console.log('Technician Details:', results);

    const technicianDetails = results[0];
    res.json({
      success: true,
      technicianDetails: technicianDetails
    });
  });
});


// Update Technician Profile
app.put('/update-profile', authenticateJWT, (req, res) => {
  const { user_name, phone_number, email } = req.body;
  const technicianId = req.user.user_id;

  // Validate input (can be extended as needed)
  if (!user_name || !phone_number || !email) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }

  // Query to update technician details
  const query = `
    UPDATE User
    SET user_name = ?, phone_number = ?, email = ?
    WHERE user_id = ?
  `;

  db.query(query, [user_name, phone_number, email, technicianId], (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Error updating profile.' });
    }
    res.json({ success: true, message: 'Profile updated successfully.' });
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
