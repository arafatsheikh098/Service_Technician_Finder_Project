const express = require('express');
const router = express.Router();
const authenticateJWT = require('../middleware/authenticateJWT');
// const customerController = require('../controllers/customerController');
const bookingController = require('../controllers/bookingController');

router.post('/api/bookings', authenticateJWT,bookingController.PutBooking);
    router.get('/api/bookings', authenticateJWT,bookingController.Getbooking);
    router.put('/api/bookings/:bookingId', authenticateJWT,bookingController.PutReview);
    router.get('/api/bookings', authenticateJWT,bookingController.GetBooklingsOfUser);
    router.get('/booking-history', authenticateJWT,bookingController.BookingHistory);
    router.get('/pending-bookings', authenticateJWT,bookingController.pendingBooking);
module.exports = router;