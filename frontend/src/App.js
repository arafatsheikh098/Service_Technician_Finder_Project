import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Signup from './components/Signup';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import UpdateProfile from './components/UpdateProfile';
import ForgotPassword from './components/ForgotPassword';        
// Uncomment when you are ready to implement these routes
// import VerifyCode from './components/VerifyCode';                
// import ResetPassword from './components/ResetPassword';          

// PrivateRoute component to protect routes
const PrivateRoute = ({ element, ...rest }) => {
  const token = localStorage.getItem('token');  // Check if user is logged in
  return token ? element : <Navigate to="/login" />;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={localStorage.getItem('token') ? <Navigate to="/dashboard" /> : <Navigate to="/login" />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<PrivateRoute element={<Dashboard />} />} />
        <Route path="/update-profile" element={<UpdateProfile />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />  {/* Route for forgot password */}
        {/* Add routes for verify code and reset password */}
        {/* <Route path="/verify-code" element={<VerifyCode />} /> */}
        {/* <Route path="/reset-password" element={<ResetPassword />} /> */}
      </Routes>
    </Router>
  );
}

export default App;
