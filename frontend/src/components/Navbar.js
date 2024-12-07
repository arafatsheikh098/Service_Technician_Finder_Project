import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Navbar.css';
import logo from '../assets/logo.png';

function Navbar() {
  const navigate = useNavigate(); // For programmatic navigation
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');

  const handleLogout = () => {
    // Clear the token and role from localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    // Redirect to the login page
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="logo">
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
      {!token ? (
        <li className="auth-link"><Link to="/login">Login</Link></li>
      ) : (
        <li className="auth-link">
          {/* Uncomment the button below when handleLogout is defined */}
          {/* <button onClick={handleLogout} className="logout-button">Logout</button> */}
        </li>
      )}
    </ul>
  </div>
    </nav>
  );
}

export default Navbar;
