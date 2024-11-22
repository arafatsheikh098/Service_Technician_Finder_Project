import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css'; // Import the CSS file

const Dashboard = () => {
  const [message, setMessage] = useState('');
  const [cities, setCities] = useState([]);
  const [areas, setAreas] = useState([]);
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [technicians, setTechnicians] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // Fetch dashboard message
      axios
        .get('http://localhost:8000/dashboard', {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((response) => {
          setMessage(response.data.message);
        })
        .catch(() => {
          setMessage('Access denied. Please log in.');
        });

      // Fetch cities
      axios
        .get('http://localhost:8000/api/cities')
        .then((response) => {
          setCities(response.data);
        })
        .catch((error) => console.error('Error fetching cities:', error));
    } else {
      setMessage('Access denied. Please log in.');
    }
  }, []);

  // Fetch areas when a city is selected
  const handleCityChange = (e) => {
    const cityId = e.target.value;
    setSelectedCity(cityId);
    axios
      .get(`http://localhost:8000/api/areas/${cityId}`)
      .then((response) => {
        setAreas(response.data);
        setSelectedArea(''); // Reset area dropdown
      })
      .catch((error) => console.error('Error fetching areas:', error));
  };

  // Fetch technicians for the selected area
  const fetchTechnicians = (zipcode) => {
    axios
      .get(`http://localhost:8000/api/technicians/${zipcode}`)
      .then((response) => {
        if (response.data.success) {
          setTechnicians(response.data.technicians);
        }
      })
      .catch((error) => console.error('Error fetching technicians:', error));
  };

  // Handle search button click
  const handleSearch = () => {
    if (selectedCity && selectedArea) {
      fetchTechnicians(selectedArea);
    } else {
      alert('Please select both city and area to search.');
    }
  };

  // Handle booking a technician
  const handleBook = (technician_id) => {
    const token = localStorage.getItem('token');

    if (token) {
      const bookingData = {
        technician_id,
        booking_date: new Date().toISOString().split('T')[0], // Current date
        status: 'Pending', // Default status
      };

      axios
        .post('http://localhost:8000/api/bookings', bookingData, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then(() => {
          alert('Booking created successfully!');
        })
        .catch((error) => {
          console.error('Error creating booking:', error.response?.data?.message || error.message);
          alert('Failed to create booking. Please try again.');
        });
    } else {
      alert('You must be logged in to book a technician.');
    }
  };

  // Delete account function
  const handleDeleteAccount = () => {
    const token = localStorage.getItem('token');
    if (token) {
      axios
        .delete('http://localhost:8000/delete-account', {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then(() => {
          setMessage('Account deleted successfully. Redirecting to signup...');
          localStorage.removeItem('token'); // Remove token on successful deletion
          setTimeout(() => {
            navigate('/signup'); // Redirect to signup page
          }, 5000);
        })
        .catch(() => {
          setMessage('Error deleting account.');
        });
    }
  };

  // Logout function
  const handleLogout = () => {
    localStorage.removeItem('token'); // Remove token
    navigate('/login'); // Redirect to login page
  };

  return (
    <div className="dashboard-container">
      {/* Top Left - Customer Dashboard and Welcome Message */}
      <div className="top-left">
        <h1>Customer Dashboard</h1>
        <p>{message}</p>
      </div>

      {/* Top Right - Delete and Logout Buttons */}
      <div className="top-right">
        <button onClick={handleDeleteAccount}>Delete Account</button>
        <button onClick={handleLogout}>Logout</button>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Search Section */}
        <div className="search-section">
          <h3>Find a Technician</h3>
          <div className="form-group">
            <label>City:</label>
            <select value={selectedCity} onChange={handleCityChange}>
              <option value="">Select City</option>
              {cities.map((city) => (
                <option key={city.city_id} value={city.city_id}>
                  {city.city_name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Area:</label>
            <select
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
              disabled={!selectedCity}
            >
              <option value="">Select Area</option>
              {areas.map((area) => (
                <option key={area.zipcode} value={area.zipcode}>
                  {area.area}
                </option>
              ))}
            </select>
          </div>

          <button onClick={handleSearch}>Search</button>
        </div>

        {/* Technicians List */}
        {technicians.length > 0 && (
          <div className="technicians-list">
            <h2>Technicians</h2>
            <ul>
              {technicians.map((tech) => (
                <li key={tech.user_id}>
                  <strong>{tech.user_name}</strong> - {tech.experienced_year} years experience
                  <br />
                  Services: {tech.services || 'No services available'}
                  <br />
                  Phone: {tech.phone_number}
                  <br />
                  <button onClick={() => handleBook(tech.user_id)}>Book</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
