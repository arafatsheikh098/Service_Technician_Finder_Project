import React, { useState, useEffect } from 'react';
import axios from 'axios';

const TechnicianDashboard = () => {
  const [experiencedYear, setExperiencedYear] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleUpdateExperience = async () => {
    setMessage(''); // Clear previous messages
    setError(''); // Clear previous errors

    const token = localStorage.getItem('token');
    if (!experiencedYear) {
      setError('Please enter a valid experience year.');
      return;
    }

    if (!token) {
      setError('You are not authenticated. Please log in.');
      return;
    }

    try {
      const response = await axios.put(
        'http://localhost:8000/update-experience',
        { experienced_year: experiencedYear },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setMessage('Experience updated successfully!');
      } else {
        setError(response.data.message || 'Failed to update experience.');
      }
    } catch (err) {
      console.error('Error during API call:', err);
      setError('An error occurred while updating experience.');
    }
  };

  useEffect(() => {
    // Check if user is a technician
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Access denied. Please log in.');
      return;
    }
  }, []);

  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <h1>Technician Dashboard</h1>
      <div style={{ marginBottom: '20px' }}>
        <label>Update Experience (Years):</label>
        <input
          type="number"
          value={experiencedYear}
          onChange={(e) => setExperiencedYear(e.target.value)}
          placeholder="Enter your experience"
          style={{ marginLeft: '10px', padding: '5px' }}
        />
      </div>
      <button onClick={handleUpdateExperience} style={{ padding: '10px 20px', cursor: 'pointer' }}>
        Update Experience
      </button>
      <div style={{ marginTop: '20px' }}>
        {message && <p style={{ color: 'green' }}>{message}</p>}
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </div>
    </div>
  );
};

export default TechnicianDashboard;

