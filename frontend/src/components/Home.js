

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css'; 
import logo from '../assets/logo.png';

const Home = () => {
  const navigate = useNavigate();

  // State to control the visibility of services list
  const [showServices, setShowServices] = useState(false);

  // List of services provided
  const services = [
    'Car Mechanic',
    'Painter',
    'Electrician',
    'Plumber',
    'HVAC Technician',
    'Gardener',
    'Cleaning Service',
    'Carpenter',
    'Mason',
  ];

  // Function to navigate to different pages
  const handleNavigate = (path) => {
    navigate(path);
  };

  // Function to toggle the visibility of the services list
  const toggleServices = () => {
    setShowServices(!showServices);
  };

  return (
    <div className="home-container">
     
      <nav className="navbar">
        <div className="logo" onClick={() => handleNavigate('/home')}>
          <img src={logo} alt="Service Technician Finder Logo" />
          <span>Service Technician Finder</span>
        </div>
        <ul className="nav-links">
          <li onClick={toggleServices}>Services We Provide</li>
          <li onClick={() => handleNavigate('/contact')}>Contact Us</li>
          <li onClick={() => handleNavigate('/login')}>Log In</li>
          <li onClick={() => handleNavigate('/about')}>About</li>
        </ul>
      </nav>

      {/* Main Content */}
      <div className="main-content">
        <h1>Find Reliable Technicians Near You</h1>
        <p>Connecting you with trusted professionals for all your home and business needs.</p>

        {/* Register Now Button */}
        <button className="register-btn" onClick={() => handleNavigate('/signup')}>
          Register Now
        </button>
      </div>

      {/* Services List - Only displayed when showServices is true */}
      {showServices && (
        <div className="services-main">
          <h2>Services We Provide</h2>
          <ul className="services-list">
            {services.map((service, index) => (
              <li key={index} className="service-item">
                <span>{service}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer */}
      <footer className="footer">
        <p>&copy; 2024 Service Technician Finder. All Rights Reserved.</p>
      </footer>
    </div>
  );
};

export default Home;
