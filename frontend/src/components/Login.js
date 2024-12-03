import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import './Login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      setError('Please enter email and password.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    try {
      
      const response = await axios.post('http://localhost:8000/login', { email, password });

      if (response.data.success) {
        
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('role', response.data.role); 

        
        if (response.data.role === 'Customer') {
          navigate('/dashboard');
        } else if (response.data.role === 'Technician') {
          navigate('/technician-dashboard');
          
        }
        else if (response.data.role === 'Admin') {
          navigate('/create-technician');
        }
           else {
          setError('Invalid user role.');
        }
      } else {
        setError(response.data.message || 'Login failed.');
      }
    } catch (error) {
      setError(error.response?.data?.message || 'An error occurred during login.');
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>Login</h1>
        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <br />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <br />
          <button type="submit">Login</button>
        </form>

        {error && <p style={{ color: 'red' }}>{error}</p>}

        <p>
          Don't have an account?{' '}
          <Link to="/signup" className="signup-link">
            Sign Up
          </Link>
        </p>

       
        <p>
          <Link to="/forgot-password" className="forgot-password-link">
            Forgot Password?
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
