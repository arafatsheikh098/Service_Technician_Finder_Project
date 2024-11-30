import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './CreateTechnician.css'; // Import the CSS file

const CreateTechnician = () => {
  const [services, setServices] = useState([]);
  const [cities, setCities] = useState([]);
  const [areas, setAreas] = useState([]);
  const [selectedCity, setSelectedCity] = useState('');
  const [formData, setFormData] = useState({
    user_name: '',
    password: '',
    phone_number: '',
    email: '',
    experienced_year: '',
    location: '',
    service_names: [],
  });
  const [errors, setErrors] = useState({
    phone_number: '',
    email: '',
  });
  const navigate = useNavigate();

  useEffect(() => {
    axios
      .get('http://localhost:8000/api/cities')
      .then((response) => setCities(response.data))
      .catch((error) => console.error('Error fetching cities:', error));
  }, []);

  useEffect(() => {
    axios
      .get('http://localhost:8000/api/services')
      .then((response) => {
        setServices(response.data);
      })
      .catch((error) => console.error('Error fetching services:', error));
  }, []);

  const handleCityChange = (e) => {
    const cityId = e.target.value;
    setSelectedCity(cityId);

    axios
      .get(`http://localhost:8000/api/areas/${cityId}`)
      .then((response) => setAreas(response.data))
      .catch((error) => console.error('Error fetching areas:', error));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleServiceChange = (e) => {
    const selectedOptions = Array.from(e.target.selectedOptions);
    const selectedServiceNames = selectedOptions.map((option) => option.value);

    setFormData((prevState) => ({
      ...prevState,
      service_names: selectedServiceNames,
    }));
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const validatePhoneNumber = (phone) => {
    const phoneRegex = /^[0-9]{11}$/; 
    return phoneRegex.test(phone);
  };

  const validateEmail = (email) => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validate phone number
    if (!validatePhoneNumber(formData.phone_number)) {
      setErrors({ ...errors, phone_number: 'Invalid phone number. Must be 11 digits.' });
      return;
    } else {
      setErrors({ ...errors, phone_number: '' });
    }

    // Validate email
    if (!validateEmail(formData.email)) {
      setErrors({ ...errors, email: 'Invalid email address.' });
      return;
    } else {
      setErrors({ ...errors, email: '' });
    }

    console.log('Form Data:', formData);

    axios
      .post('http://localhost:8000/create-technician', formData, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      })
      .then((response) => {
        console.log('Technician created successfully:', response.data);
        alert('Technician created successfully!');
        setFormData({
          user_name: '',
          password: '',
          phone_number: '',
          email: '',
          experienced_year: '',
          location: '',
          service_names: [],
        });
      })
      .catch((error) => {
        console.error('Error creating technician:', error);
        alert('Error creating technician. Please try again.');
      });
  };

  return (
    <div>
      <button className="logout-button" onClick={handleLogout}>
        Logout
      </button>

      <h2 className="create-technician-form-title">Create Technician</h2>

      <form onSubmit={handleSubmit} className="create-technician-form">
        <div className="form-field">
          <label>User Name:</label>
          <input
            type="text"
            name="user_name"
            value={formData.user_name}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="form-field">
          <label>Password:</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="form-field">
          <label>Phone Number:</label>
          <input
            type="text"
            name="phone_number"
            value={formData.phone_number}
            onChange={handleInputChange}
            required
          />
          {errors.phone_number && <p className="error">{errors.phone_number}</p>}
        </div>

        <div className="form-field">
          <label>Email:</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            required
          />
          {errors.email && <p className="error">{errors.email}</p>}
        </div>

        <div className="form-field">
          <label>Experience Years:</label>
          <input
            type="number"
            name="experienced_year"
            value={formData.experienced_year}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="form-field">
          <label>City:</label>
          <select value={selectedCity} onChange={handleCityChange} required>
            <option value="">Select City</option>
            {cities.map((city) => (
              <option key={city.city_id} value={city.city_id}>
                {city.city_name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label>Area:</label>
          <select
            name="location"
            value={formData.location}
            onChange={handleInputChange}
            required
          >
            <option value="">Select Area</option>
            {areas.map((area) => (
              <option key={area.zipcode} value={area.area}>
                {area.area}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label>Services:</label>
          <select
            name="service_names"
            value={formData.service_names}
            onChange={handleServiceChange}
            multiple
            required
          >
            {services.map((service) => (
              <option key={service.service_name} value={service.service_name}>
                {service.service_name}
              </option>
            ))}
          </select>
        </div>

        <button type="submit">Create Technician</button>
      </form>
    </div>
  );
};

export default CreateTechnician;
