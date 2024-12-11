const express = require('express');
const router = express.Router();
const authenticateJWT = require('../middleware/authenticateJWT');
const customerController = require('../controllers/customerController');

// Customer Dashboard Route
router.get('/dashboard', authenticateJWT, customerController.Customerdashboard);

router.get('/api/best-technician/:zipcode',customerController.BestTechncian);
router.get('/api/customer-details', authenticateJWT,customerController.CustomerDetails);
// Update Customer Details Route
router.put('/customer-details', authenticateJWT, customerController.updateCustomerDetails);
router.get('/api/cities',customerController.cities);
router.get('/api/areas/:city_id',customerController.areas);
router.get('/api/services',customerController.services);
router.get('/api/technicians/:zipcode', customerController.TechnicanByZipcode);


// // Search Technicians Route
// router.get('/search-technicians', authenticateJWT, customerController.searchTechnicians);

module.exports = router;
