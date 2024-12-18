

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Contact'
import './Home.css'; 
import logo from '../assets/logo.png';

const Home = () => {
  const navigate = useNavigate();

  const [showServices, setShowServices] = useState(false);

 
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

  
  const handleNavigate = (path) => {
    navigate(path);
  };

 
  const toggleServices = () => {
    setShowServices(!showServices);
  };

  return (
    <div className="home-container">
     
      {/* <nav className="navbar">
        <div className="logo" onClick={() => handleNavigate('/home')}>
          <img src={logo} alt="Service Technician Finder Logo" />
          <span>Service Technician Finder</span>
        </div>
        <ul className="nav-links">
          
          <li onClick={() => handleNavigate('/services')}>Services We Provide</li>
          <li onClick={() => handleNavigate('/Contact')}>Contact Us</li>
          <li onClick={() => handleNavigate('/login')}>Log In</li>
          <li onClick={() => handleNavigate('/About')}>About</li>
        </ul>
      </nav> */}

    
      <div className="main-content">
        <h1>Find Reliable Technicians Near You</h1>
        <p>Connecting you with trusted professionals for all your home and business needs.</p>

        
        <button className="register-btn" onClick={() => handleNavigate('/signup')}>
          Register Now
        </button>
      </div>

    

      
      <footer className="footer">
        <p>&copy; 2024 Service Technician Finder. All Rights Reserved.</p>
      </footer>
    </div>
  );
};

export default Home;
