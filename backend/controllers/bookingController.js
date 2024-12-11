const db = require('../config/db');
  // Create a booking
  const PutBooking=(req, res) => {
    const { technician_id, booking_date, status } = req.body;
    const sql = 'INSERT INTO Booking (customer_id, technician_id, booking_date, status) VALUES (?, ?, ?, ?)';
    db.query(sql, [req.user.user_id, technician_id, booking_date, status], (err, results) => {
      if (err) return res.status(500).send(err);
      res.status(201).json({ booking_id: results.insertId });
    });
  };
  
  // Get bookings
 const Getbooking=(req, res) => {
    const sql = `
      SELECT Booking.booking_id, Booking.booking_date, Booking.status, User.user_name AS technician_name
      FROM Booking
      JOIN User ON Booking.technician_id = User.user_id
      WHERE Booking.customer_id = ?`;
    db.query(sql, [req.user.user_id], (err, results) => {
      if (err) return res.status(500).send(err);
      res.json(results);
    });
  };
  
  //  update booking status and review
 const PutReview= (req, res) => {
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
  };
  
  // Get Bookings for the Logged-in User
  const GetBooklingsOfUser= (req, res) => {
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
  };

  // Get pending bookings
const pendingBooking =(req, res) => {
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
};


  // Get booking history 
const BookingHistory= (req, res) => {
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
};

  
  
  


  module.exports={PutBooking,PutReview,Getbooking,GetBooklingsOfUser,BookingHistory,pendingBooking}