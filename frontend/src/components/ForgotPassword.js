import React, { useState } from 'react';
import axios from 'axios';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmitEmail = async (e) => {
    e.preventDefault();

    if (!email) {
      setError('Please enter your email.');
      return;
    }

    try {
      const response = await axios.post('http://localhost:8000/forgot-password', { email });

      if (response.data.success) {
        setMessage('A code has been sent to your email.');
      } else {
        setError(response.data.message || 'Error sending code.');
      }
    } catch (err) {
      setError('An error occurred.');
    }
  };

  return (
    <div>
      <h2>Forgot Password</h2>
      <form onSubmit={handleSubmitEmail}>
        <input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button type="submit">Send Code</button>
      </form>
      {message && <p>{message}</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
};

export default ForgotPassword;
