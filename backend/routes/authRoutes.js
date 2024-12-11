const express = require('express');
const router = express.Router(); 

const { signup, login, resetPassword, deleteAccount } = require('../controllers/authControllers');

// Define routes
router.post('/signup', signup);
router.post('/login', login);
router.post('/reset-password', resetPassword);
router.delete('/delete-account', deleteAccount);

// Export the router
module.exports = router; // Correct export
