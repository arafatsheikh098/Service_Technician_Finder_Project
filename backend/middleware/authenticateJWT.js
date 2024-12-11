const jwt = require('jsonwebtoken');
const authenticateJWT = (req, res, next) => {
    const token = req.header('Authorization')?.split(' ')[1];
    if (!token) return res.status(403).json({ success: false, message: 'Access denied.' });
  
    jwt.verify(token, SECRET_KEY, (err, user) => {
      if (err) return res.status(403).json({ success: false, message: 'Invalid token.' });
      req.user = user;
      next();
    });
  };

module.exports = authenticateJWT;