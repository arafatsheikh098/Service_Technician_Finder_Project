const express = require('express');
const router = express.Router();
const authenticateJWT = require('../middleware/authenticateJWT');
const upload = require('../config/multerConfig'); 
const adminController = require('../controllers/adminController');


router.post('/create-technician', authenticateJWT, upload.single('profile_picture'), adminController.createTechnician);
router.get('/api/technicians',adminController.TechnicianInfo);
router.delete('/api/technicians/:technicianId',adminController.deleteTechnician);

module.exports = router;
