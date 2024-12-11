
const db = require('../config/db');

const Customerdashboard =(req, res) => {
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
  };


  // best technician 
const BestTechncian= (req, res) => {
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
  };

  // Get Customer Details
const CustomerDetails= (req, res) => {
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
  };

  const updateCustomerDetails = (req, res) => {
    const { user_name, email, phone_number } = req.body;
    const userId = req.user.user_id;
  
    // Validate input fields
    if (!user_name || !email || !phone_number) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }
  
    // Function to update profile
    const updateProfile = () => {
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
    };
  
    // Check if the email is already in use by another user
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
  };


// Get Cities
const cities= (req, res) => {
    db.query('SELECT city_id, city_name FROM City_location', (err, results) => {
      if (err) return res.status(500).send('Error fetching cities.');
      res.json(results);
    });
  };
  
  // Get Areas by City
 const areas=(req, res) => {
    db.query('SELECT zipcode, area FROM Location WHERE city_id = ?', [req.params.city_id], (err, results) => {
      if (err) return res.status(500).send('Error fetching areas.');
      res.json(results);
    });
  };
  // Get Services
  const services=(req, res) => {
    db.query('SELECT service_name FROM Service', (err, results) => {
      if (err) return res.status(500).send('Error fetching services.');
      res.json(results);
    });
  };
  // Get Technicians by Area (Zipcode)
const TechnicanByZipcode=(req, res) => {
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
  };


  


  module.exports={Customerdashboard,BestTechncian,CustomerDetails,updateCustomerDetails,cities,areas,services,TechnicanByZipcode}