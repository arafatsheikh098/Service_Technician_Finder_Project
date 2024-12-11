
const db = require('../config/db');

const Techniciandashboard =(req, res) => {
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
  };

  //technician-details
const TechnicianDetails= (req, res) => {
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
  };


  // best technician 
const BestTechncian= (req, res) => {
    const userId = req.user.user_id;
  
  
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
  };


//technican details
const TechDetails =(req, res) => {
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
  
     
       const technicianDetails = results[0];
   
      // console.log(technicianDetails);
      res.json(technicianDetails);
   
    });
  };
 const updateProfile= (req, res) => {
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
  };
  

 

  
  


  module.exports={Techniciandashboard,BestTechncian,TechnicianDetails,TechDetails,updateProfile}