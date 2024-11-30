import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

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
    service_names: [], // Array for storing selected service names
  });
  const navigate = useNavigate();
  // Fetch cities using axios
  useEffect(() => {
    axios
      .get('http://localhost:8000/api/cities')
      .then((response) => setCities(response.data))
      .catch((error) => console.error('Error fetching cities:', error));
  }, []);

  // Fetch services using axios
  useEffect(() => {
    axios
      .get('http://localhost:8000/api/services')
      .then((response) => {
        console.log('Services:', response.data); // Log to ensure services are being fetched
        setServices(response.data);
      })
      .catch((error) => console.error('Error fetching services:', error));
  }, []);

  // Fetch areas when a city is selected
  const handleCityChange = (e) => {
    const cityId = e.target.value;
    setSelectedCity(cityId);

    axios
      .get(`http://localhost:8000/api/areas/${cityId}`)
      .then((response) => setAreas(response.data))
      .catch((error) => console.error('Error fetching areas:', error));
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  // Handle service selection change
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

  // Submit handler
  const handleSubmit = (e) => {
    e.preventDefault(); // Prevent default form submission
    console.log('Form Data:', formData);
    
    axios
      .post('http://localhost:8000/create-technician', formData,
        {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`, // Assuming the token is stored in localStorage
              'Content-Type': 'application/json', // Ensure proper content type
            },
          }
      )
      .then((response) => {
        console.log('Technician created successfully:', response.data);
        // Handle success response, e.g., show a success message
        alert('Technician created successfully!');
        // Optionally, reset the form
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
        // Handle error response, e.g., show an error message
        alert('Error creating technician. Please try again.');
      });
  };

  return (
    <div>
         <button onClick={handleLogout}>Logout</button>
      <h2>Create Technician</h2>

      <form onSubmit={handleSubmit}>
        <div>
          <label>User Name:</label>
          <input
            type="text"
            name="user_name"
            value={formData.user_name}
            onChange={handleInputChange}
            required
          />
        </div>
        <div>
          <label>Password:</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            required
          />
        </div>
        <div>
          <label>Phone Number:</label>
          <input
            type="text"
            name="phone_number"
            value={formData.phone_number}
            onChange={handleInputChange}
            required
          />
        </div>
        <div>
          <label>Email:</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            required
          />
        </div>
        <div>
          <label>Experience Years:</label>
          <input
            type="number"
            name="experienced_year"
            value={formData.experienced_year}
            onChange={handleInputChange}
            required
          />
        </div>
        <div>
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
        <div>
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
        <div>
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
