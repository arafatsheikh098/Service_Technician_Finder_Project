import React from 'react';
import { Link } from 'react-router-dom';
import './Navbar.css';
import logo from '../assets/logo.png';
function Navbar() {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role'); 

  return (
    <nav className="navbar">
       <div className="logo" >
          <img src={logo} alt="Service Technician Finder Logo" />
          <span>Service Technician Finder</span>
        </div>
        <div>

        {/* Common Links for all users */}
        <ul className="navbar-links">
          <li><Link to="/home">Home</Link></li>
          <li><Link to="/services">Services</Link></li>
          <li><Link to="/about">About Us</Link></li>
          <li><Link to="/contact">Contact</Link></li>
        </ul>

        {/* Authentication Links for guests
        {!token && (
          <div className="auth-links">
            <Link to="/login">Login</Link> | <Link to="/signup">Sign Up</Link>
          </div>
        )} */}

        {/* Customer Links */}
        {/* {role === 'Customer' && token && (
          <div className="customer-links">
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/update-profile">Update Profile</Link>
          </div>
        )} */}

        {/* Technician Links */}
        {/* {role === 'Technician' && token && (
          <div className="technician-links">
            <Link to="/technician-dashboard">Technician Dashboard</Link>
            <Link to="/update-profile">Update Profile</Link>
          </div>
        )} */}

        {/* Admin Links (if needed) */}
        {/* {role === 'Admin' && token && (
          <div className="admin-links">
            <Link to="/admin-dashboard">Admin Dashboard</Link>
            <Link to="/create-technician">Create Technician</Link>
          </div>
        )} */}

        {/* Logout Link */}
        {token && (
          <div className="logout">
            <Link to="/logout" onClick={() => {
              localStorage.removeItem('token');
              localStorage.removeItem('role');
            }}>Logout</Link>
          </div>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
