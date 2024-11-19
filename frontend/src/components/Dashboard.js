import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const [message, setMessage] = useState('');
  const navigate = useNavigate(); // To navigate after deletion

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
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
    } else {
      setMessage('Access denied. Please log in.');
    }
  }, []);

  // Delete Account Function
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
            navigate('/signup'); // Redirect to signup page after 5 seconds
          }, 5000);
        })
        .catch(() => {
          setMessage('Error deleting account.');
        });
    }
  };

  // Logout Function
  const handleLogout = () => {
    localStorage.removeItem('token'); // Remove token
    navigate('/login'); // Redirect to login page
  };

  return (
    <div>
      <h1>Dashboard</h1>
      <p>{message}</p>
      <button onClick={handleDeleteAccount}>Delete Account</button>
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
};

export default Dashboard;
