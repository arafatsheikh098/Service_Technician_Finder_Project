import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Signup from './components/Signup';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ForgotPassword from './components/ForgotPassword';        // Add ForgotPassword component
import VerifyCode from './components/VerifyCode';                // Add VerifyCode component
import ResetPassword from './components/ResetPassword';          // Add ResetPassword component

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />  {/* Route for forgot password */}
        <Route path="/verify-code" element={<VerifyCode />} />          {/* Route for verifying code */}
        <Route path="/reset-password" element={<ResetPassword />} />    {/* Route for resetting password */}
      </Routes>
    </Router>
  );
}

export default App;
