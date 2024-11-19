import React, { useState } from 'react';
import axios from 'axios';

const VerifyCode = ({ email }) => {
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleVerifyCode = async (e) => {
    e.preventDefault();

    if (!code) {
      setError('Please enter the code.');
      return;
    }

    try {
      const response = await axios.post('http://localhost:8000/verify-code', { email, code });

      if (response.data.success) {
        setMessage('Code verified! You can now reset your password.');
        // Redirect to password reset page after success
      } else {
        setError(response.data.message || 'Invalid code.');
      }
    } catch (err) {
      setError('An error occurred.');
    }
  };

  return (
    <div>
      <h2>Verify Code</h2>
      <form onSubmit={handleVerifyCode}>
        <input
          type="text"
          placeholder="Enter the code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
        />
        <button type="submit">Verify</button>
      </form>
      {message && <p>{message}</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
};

export default VerifyCode;
