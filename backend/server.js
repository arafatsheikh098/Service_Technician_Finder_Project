const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const mysql = require('mysql2');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// MySQL connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '***REMOVED***', 
  database: 'ServiceTechnicianFinder',
});

// JWT Secret Key
const SECRET_KEY = 'your_secret_key';

// Set up multer storage for profile picture
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Directory to store the uploaded files
  },
  filename: (req, file, cb) => {
    const fileExtension = path.extname(file.originalname); // Get the file extension
    const fileName = `${Date.now()}${fileExtension}`; // Generate a unique file name
    cb(null, fileName);
  },
});
const upload = multer({ storage: storage });
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


//  Signup
app.post('/signup', (req, res) => {
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
});

// log in
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

// Delete Account
app.delete('/delete-account', authenticateJWT, (req, res) => {
  const userId = req.user.user_id;
  db.query('DELETE FROM User WHERE user_id = ?', [userId], (err) => {
    if (err) return res.status(500).json({ success: false, message: 'Error deleting account.' });
    res.json({ success: true, message: 'Account deleted successfully.' });
  });
});

// Customer Dashboard Endpoint
app.get('/dashboard', authenticateJWT, (req, res) => {
  const query = 'SELECT last_login FROM Customer WHERE user_id = ?';

  
  db.query(query, [req.user.user_id], (err, results) => {
    if (err) {
      console.error('Error fetching last login time:', err);
      return res.status(500).json({ 
        success: false, 
        message: 'Error fetching last login time' 
      });
    }

    if (results.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    const lastLogin = results[0].last_login;

  
    res.json({
      success: true,
      message: `Welcome to the dashboard, user ${req.user.user_id}`,
      role: req.user.role, 
      last_login: lastLogin,
    });
  });
});


// Technician Dashboard Endpoint
app.get('/technician-dashboard', authenticateJWT, (req, res) => {
  if (req.user.role !== 'Technician') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Only technicians can access this dashboard.',
    });
  }
  res.json({
    success: true,
    message: `Welcome to the Technician Dashboard, Technician ID: ${req.user.user_id}`,
    role: req.user.role,
  });
});

//technician-details
app.get('/technician-details', authenticateJWT, (req, res) => {
  const technicianId = req.user.user_id;
  // console.log( technicianId); 

  const query = `
    SELECT 
      User.user_name, 
      User.phone_number, 
      User.email, 
      Technician.experienced_year,
      Technician.profile_picture, 
      (SELECT AVG(Booking.rating) FROM Booking WHERE technician_id = ?) AS rating
    FROM User
    JOIN Technician ON User.user_id = Technician.user_id
    WHERE User.user_id = ?
  `;

  db.query(query, [technicianId, technicianId], (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Error fetching technician details.' });
    }

    // console.log( results); 

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
    WHERE Booking.technician_id = ? AND Booking.status  in( 'Confirmed' , 'Pending')
  `;

  db.query(query, [technicianId], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Error fetching pending bookings.' });
    res.json({ pendingBookings: results });
  });
});

// Get booking history 
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
    WHERE Booking.technician_id = ? AND Booking.status not in ( 'Pending' , 'Confirmed')
  `;

  db.query(query, [technicianId], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Error fetching booking history.' });
    res.json({ bookingHistory: results });
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
// Get Services
app.get('/api/services', (req, res) => {
  db.query('SELECT service_name FROM Service', (err, results) => {
    if (err) return res.status(500).send('Error fetching services.');
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
// best technician at tachnician dashboard 

// app.get('/best-technician', authenticateJWT,(req, res) => {
//   const userId = req.user.user_id;
//   console.log(userId)
//   const query = `
//       SELECT 
//           t.user_id,
//           u.user_name,
//           t.experienced_year,
//           AVG(b.rating) AS avg_rating,
//           COUNT(b.booking_id) AS total_bookings
//       FROM Technician t
//       JOIN User u ON t.user_id = u.user_id
//       JOIN Booking b ON b.technician_id = t.user_id
//       JOIN Location l ON t.zipcode = l.zipcode
//       GROUP BY t.user_id, l.city_id
//       ORDER BY total_bookings DESC, avg_rating DESC
//       LIMIT 1;
//   `;
  
//   db.query(query,[userId], (error, results) => {
//       if (error) {
//           return res.status(500).send('Error fetching best technician.');
//       }
//       res.json(results[0]);
//       console.log(results[0]);
//   });
// });
app.get('/best-technician', authenticateJWT, (req, res) => {
  const userId = req.user.user_id;
  
  // Fetch the technician's location (zipcode) to filter by the technician's area
  const locationQuery = `
      SELECT zipcode
      FROM Technician
      WHERE user_id = ?
  `;

  db.query(locationQuery, [userId], (error, locationResults) => {
    if (error) {
      return res.status(500).send('Error fetching technician location.');
    }

    if (locationResults.length === 0) {
      return res.status(404).send('Technician not found.');
    }

    const technicianZipcode = locationResults[0].zipcode;

    // Now, find the best technician in the same area (zipcode)
    const query = `
      SELECT 
          t.user_id,
          u.user_name,
          t.experienced_year,
          AVG(b.rating) AS avg_rating,
          COUNT(b.booking_id) AS total_bookings
      FROM Technician t
      JOIN User u ON t.user_id = u.user_id
      JOIN Booking b ON b.technician_id = t.user_id
      JOIN Location l ON t.zipcode = l.zipcode
      WHERE t.zipcode = ?
      GROUP BY t.user_id
      ORDER BY total_bookings DESC, avg_rating DESC
      LIMIT 1;
    `;

    db.query(query, [technicianZipcode], (error, results) => {
      if (error) {
        return res.status(500).send('Error fetching best technician.');
      }
      res.json(results[0]);
    });
  });
});


// best technician 
app.get('/api/best-technician/:zipcode', (req, res) => {
  const zipcode = req.params.zipcode;
  // console.log(zipcode);
  const query = `
    SELECT t.user_id, t.experienced_year, u.user_name, AVG(b.rating) AS avg_rating, COUNT(b.booking_id) AS total_bookings
    FROM Technician t
    JOIN Booking b ON t.user_id = b.technician_id
    JOIN User u ON t.user_id = u.user_id
    WHERE t.zipcode = ? AND b.booking_date >=( DATE_SUB(CURDATE(), INTERVAL 1 MONTH) AND LAST_DAY(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)))
    GROUP BY t.user_id
    ORDER BY avg_rating DESC, total_bookings DESC
    LIMIT 1;
  `;

  db.query(query, [zipcode], (err, results) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Error fetching best technician.' });
    } else {
      res.json(results[0]);
      // console.log(results[0]);
    }
  });
});


app.put('/api/customer-details', authenticateJWT, (req, res) => {
  const { user_name, email, phone_number } = req.body;
  const userId = req.user.user_id; // Get the user_id from the JWT token

 
  if (!user_name || !email || !phone_number) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }

 
  if (email === req.user.email) {
    updateProfile();
  } else {
 
    const checkEmailQuery = 'SELECT * FROM User WHERE LOWER(email) = LOWER(?) AND user_id != ?';
    db.query(checkEmailQuery, [email, userId], (err, results) => {
      if (err) {
        console.error('Error checking email:', err);
        return res.status(500).json({ success: false, message: 'Database error while checking email.' });
      }

      if (results.length > 0) {
        return res.status(400).json({ success: false, message: 'Email already in use by another user.' });
      }

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

app.get('/api/technician-details/:technician_id', (req, res) => {
  const { technician_id } = req.params;

  const sql = `
    SELECT 
      Technician.profile_picture,
      Technician.experienced_year AS experience_years, 
      AVG(Booking.rating) AS rating,
      COUNT(Booking.review) AS reviews_count,
      COUNT(Booking.booking_id) AS booking_count
    FROM Technician
    LEFT JOIN Booking ON Technician.user_id = Booking.technician_id
    WHERE Technician.user_id = ?`;

  db.query(sql, [technician_id], (err, results) => {
    if (err) {
      console.error("Error fetching technician details:", err);
      return res.status(500).send(err);
    }

    // // Add a default image if `profile_picture` is NULL
     const technicianDetails = results[0];
    // if (technicianDetails) {
    //   technicianDetails.profile_picture = technicianDetails.profile_picture ;
    // }
    console.log(technicianDetails);
    res.json(technicianDetails);
 
  });
});


// Update Technician Profile
app.put('/update-profile', authenticateJWT, (req, res) => {
  const { user_name, phone_number, email } = req.body;
  const technicianId = req.user.user_id;


  if (!user_name || !phone_number || !email) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }


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


// Create a booking
app.post('/api/bookings', authenticateJWT, (req, res) => {
  const { technician_id, booking_date, status } = req.body;
  const sql = 'INSERT INTO Booking (customer_id, technician_id, booking_date, status) VALUES (?, ?, ?, ?)';
  db.query(sql, [req.user.user_id, technician_id, booking_date, status], (err, results) => {
    if (err) return res.status(500).send(err);
    res.status(201).json({ booking_id: results.insertId });
  });
});

// Get bookings
app.get('/api/bookings', authenticateJWT, (req, res) => {
  const sql = `
    SELECT Booking.booking_id, Booking.booking_date, Booking.status, User.user_name AS technician_name
    FROM Booking
    JOIN User ON Booking.technician_id = User.user_id
    WHERE Booking.customer_id = ?`;
  db.query(sql, [req.user.user_id], (err, results) => {
    if (err) return res.status(500).send(err);
    res.json(results);
  });
});
//  update booking status and review
app.put('/api/bookings/:bookingId', authenticateJWT, (req, res) => {
  const { bookingId } = req.params;
  const { status, rating, review } = req.body;

  const validStatuses = ['Pending', 'Confirmed', 'Completed', 'Cancelled'];

  
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  
  if (status === 'Completed') {
    
    if (rating < 1 || rating > 10) {
      return res.status(400).json({ message: 'Rating must be between 1 and 10.' });
    }

 
    if (review && review.length > 500) {
      return res.status(400).json({ message: 'Review cannot exceed 500 characters.' });
    }

  
    const sql = 'UPDATE Booking SET status = ?, rating = ?, review = ? WHERE booking_id = ?';

    db.query(sql, [status, rating, review, bookingId], (err, result) => {
      if (err) {
        console.error('Error executing query:', err);
        return res.status(500).json({ message: 'Server error while updating the booking.' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Booking not found.' });
      }

      res.json({ message: 'Booking updated successfully.' });
    });
  } else {

    const sql = 'UPDATE Booking SET status = ? WHERE booking_id = ?';

    db.query(sql, [status, bookingId], (err, result) => {
      if (err) return res.status(500).json({ message: 'Database error' });

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Booking not found.' });
      }

      res.json({ message: 'Booking status updated successfully.' });
    });
  }
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
    res.json(results[0]);  
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
    res.json(results);  
  });
});

// admin create technician 
// POST route to create a technician (with profile picture)
app.post('/create-technician', authenticateJWT, upload.single('profile_picture'), (req, res) => {
  const { user_name, password, phone_number, email, experienced_year, location, service_names } = req.body;
  const profile_picture = req.file ? req.file.filename : null; // Get the file name if uploaded
console.log(profile_picture);
  // Validate required fields
  if (!user_name || !password || !email || !experienced_year || !location || !service_names) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }

  // Hash password
  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) {
      console.error('Error hashing password:', err);
      return res.status(500).json({ success: false, message: 'Internal server error.' });
    }

    // Insert the user into the User table
    const userQuery = `
      INSERT INTO User (user_name, password, phone_number, email, role) 
      VALUES (?, ?, ?, ?, 'Technician')
    `;
    
    db.query(userQuery, [user_name, hashedPassword, phone_number, email], (err, userResult) => {
      if (err) {
        console.error('Error inserting into User:', err);
        return res.status(500).json({ success: false, message: 'Error creating technician user.' });
      }

      const user_id = userResult.insertId;

      // Insert the technician details into the Technician table
      const technicianQuery = `
        INSERT INTO Technician (user_id, experienced_year, profile_picture, zipcode) 
        VALUES (?, ?, ?, (SELECT zipcode FROM Location WHERE area = ?))
      `;

      db.query(technicianQuery, [user_id, experienced_year, profile_picture, location], (err) => {
        if (err) {
          console.error('Error inserting into Technician:', err);
          return res.status(500).json({ success: false, message: 'Error creating technician details.' });
        }

        // Insert the selected services into the Offers table
        const serviceQueries = service_names.map((serviceName) => `
          INSERT INTO Offers (technician_id, service_id) 
          VALUES (${user_id}, (SELECT service_id FROM Service WHERE service_name = '${serviceName}'))
        `);

        const allQueries = serviceQueries.join('; ');

        db.query(allQueries, (err) => {
          if (err) {
            console.error('Error inserting into Offers:', err);
            return res.status(500).json({ success: false, message: 'Error adding technician services.' });
          }

          res.status(201).json({ success: true, message: 'Technician created successfully!' });
        });
      });
    });
  });
});


//server
const port = 8000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
