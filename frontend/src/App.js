import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Home from './components/Home';
// import Navbar from './components/Navbar';
import Signup from './components/Signup';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

import TechnicianDashboard from './components/TechnicianDashboard';
import UpdateProfile from './components/UpdateProfile';
import ForgotPassword from './components/ForgotPassword'; 
import Contact from './components/Contact'; 
import About from './components/About';
import Services from './components/Services';
import CreateTechnician from './components/CreateTechnician';      

// import VerifyCode from './components/VerifyCode';                
// import ResetPassword from './components/ResetPassword';          

// PrivateRoute component to protect routes
// const PrivateRoute = ({ element, ...rest }) => {
//   const token = localStorage.getItem('token');  // Check if user is logged in
//   return token ? element : <Navigate to="/login" />;
// };
const PrivateRoute = ({ element, allowedRoles }) => {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');

  if (token && allowedRoles.includes(role)) {
    return element;
  }
  return <Navigate to="/login" />;
};

function App() {
  return (
    <Router>
      {/* <Navbar /> */}
      <Routes>
        <Route path="/" element={localStorage.getItem('token') ? <Navigate to="/dashboard" /> : <Navigate to="/login" />} />
        <Route path="/home" element={<Home />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/about" element={<About />} />
        <Route path="/services" element={<Services />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<PrivateRoute element={<Dashboard />} allowedRoles={['Customer']} />}/>
        <Route path="/technician-dashboard" element={<PrivateRoute element={<TechnicianDashboard />} allowedRoles={['Technician']} />} />
        <Route path="/update-profile" element={<UpdateProfile />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />  
         <Route path="/create-technician" element={<CreateTechnician />} /> 
        {/* <Route path="/reset-password" element={<ResetPassword />} /> */}
      </Routes>
    </Router>
  );
}

export default App;
