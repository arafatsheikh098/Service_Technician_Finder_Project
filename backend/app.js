const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const db = require('./config/db');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
const authRoutes = require('./routes/authRoutes');
 const technicianRoutes = require('./routes/technicianRoutes');
const customerRoutes = require('./routes/customerRoutes');
  const bookingRoutes = require('./routes/bookingRoutes');
 const adminRoutes = require('./routes/adminRoutes');
// const profileRoutes = require('./routes/profileRoutes');

// Use Routes
app.use('/api/auth', authRoutes);
  app.use('/api/technicians', technicianRoutes);
app.use('/api/customers', customerRoutes);
  app.use('/api/bookings', bookingRoutes);
 app.use('/api/admin', adminRoutes);
// app.use('/api/profile', profileRoutes);

// Start the server
const PORT =   8000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
