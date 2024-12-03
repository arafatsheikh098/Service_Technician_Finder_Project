import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';


const UpdateProfile = () => {
  const [customerDetails, setCustomerDetails] = useState({
    user_name: '',
    phone_number: '',
    email: '',
  });
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios
        .get('http://localhost:8000/api/customer-details', {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((response) => setCustomerDetails(response.data))
        .catch(() => setMessage('Failed to fetch customer details.'));
    } else {
      navigate('/login');
    }
  }, [navigate]);

  const handleUpdate = (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    axios
      .put('http://localhost:8000/api/customer-details', customerDetails, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(() => {
        setMessage('Profile updated successfully!');
        setErrorMessage('');
      })
      .catch(() => {
        setErrorMessage('Error updating profile. Please try again.');
      });
  };

  return (
    <div className="update-profile">
      <h1>Update Your Profile</h1>
      <form onSubmit={handleUpdate}>
        <input
          type="text"
          placeholder="Name"
          value={customerDetails.user_name}
          onChange={(e) =>
            setCustomerDetails({ ...customerDetails, user_name: e.target.value })
          }
          required
        />
        <input
          type="text"
          placeholder="Phone Number"
          value={customerDetails.phone_number}
          onChange={(e) =>
            setCustomerDetails({ ...customerDetails, phone_number: e.target.value })
          }
          required
        />
        <input
          type="email"
          placeholder="Email"
          value={customerDetails.email}
          onChange={(e) =>
            setCustomerDetails({ ...customerDetails, email: e.target.value })
          }
          required
        />
        <button type="submit">Save Changes</button>
      </form>
      {message && <p className="success">{message}</p>}
      {errorMessage && <p className="error">{errorMessage}</p>}
      <button onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
      {/* <button onClick={() => navigate('/dashboard')}>Cancel Update</button> Cancel button */}
    </div>
  );
};

export default UpdateProfile;
