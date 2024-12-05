import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './CreateTechnician.css';

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
    profile_picture: null,
  });
  const [errors, setErrors] = useState({});
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
      .then((response) => setServices(response.data))
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
    setFormData((prevState) => ({
      ...prevState,
      [name]: value,
    }));
  };

  const handleServiceChange = (e) => {
    const selectedOptions = Array.from(e.target.selectedOptions);
    const selectedServiceNames = selectedOptions.map((option) => option.value);
    setFormData((prevState) => ({
      ...prevState,
      service_names: selectedServiceNames,
    }));
  };

  const handleProfilePictureChange = (e) => {
    const file = e.target.files[0];
    setFormData((prevState) => ({
      ...prevState,
      profile_picture: file,
    }));
  };

  const validateInputs = () => {
    const errors = {};
    const phoneRegex = /^[0-9]{11}$/;
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    if (!phoneRegex.test(formData.phone_number)) {
      errors.phone_number = 'Invalid phone number. Must be 11 digits.';
    }

    if (!emailRegex.test(formData.email)) {
      errors.email = 'Invalid email address.';
    }

    setErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateInputs()) {
      return;
    }

    const formDataToSend = new FormData();
    Object.keys(formData).forEach((key) => {
      if (key === 'service_names') {
        formData[key].forEach((service) =>
          formDataToSend.append('service_names[]', service)
        );
      } else {
        formDataToSend.append(key, formData[key]);
      }
    });

    axios
      .post('http://localhost:8000/create-technician', formDataToSend, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'multipart/form-data',
        },
      })
      .then((response) => {
        alert('Technician created successfully!');
        setFormData({
          user_name: '',
          password: '',
          phone_number: '',
          email: '',
          experienced_year: '',
          location: '',
          service_names: [],
          profile_picture: null,
        });
      })
      .catch((error) => {
        console.error('Error creating technician:', error);
        alert('Error creating technician. Please try again.');
      });
  };

  return (
    <div>
      <button className="logout-button" onClick={() => navigate('/login')}>
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
            multiple
            value={formData.service_names}
            onChange={handleServiceChange}
            required
          >
            {services.map((service) => (
              <option key={service.service_name} value={service.service_name}>
                {service.service_name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label>Profile Picture:</label>
          <input
            type="file"
            name="profile_picture"
            accept="image/*"
            onChange={handleProfilePictureChange}
          />
        </div>

        <button type="submit">Create Technician</button>
      </form>
    </div>
  );
};

export default CreateTechnician;
