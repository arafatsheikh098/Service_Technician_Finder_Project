const express = require('express');
const router = express.Router();
const authenticateJWT = require('../middleware/authenticateJWT');
const technicanController = require('../controllers/technicianController');
router.get('/technician-dashboard', authenticateJWT,technicanController.Techniciandashboard);

router.get('/technician-details', authenticateJWT,technicanController.TechnicianDetails);
    router.get('/api/technician-details/:technician_id',technicanController.TechDetails);
        router.put('/update-profile', authenticateJWT,technicanController.updateProfile);
        module.exports = router;