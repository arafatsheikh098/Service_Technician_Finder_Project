import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css'; // Import the CSS file

const getCurrentDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const Dashboard = () => {
  const [message, setMessage] = useState('');
  const [cities, setCities] = useState([]);
  const [areas, setAreas] = useState([]);
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [technicians, setTechnicians] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [selectedTechnician, setSelectedTechnician] = useState('');
  const [technicianDetails, setTechnicianDetails] = useState({
    experience_years: 0,
    rating: 0,
    reviews_count: 0,
    booking_count: 0,
  });
  const [bookingDate, setBookingDate] = useState(getCurrentDate());
  const [status, setStatus] = useState('Pending');
  const [rating, setRating] = useState('');
  const [review, setReview] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [customerDetails, setCustomerDetails] = useState({
    user_name: '',
    phone_number: '',
    email: '',
  });
  const [isUpdatingInfo, setIsUpdatingInfo] = useState(false); // For toggling update form
  const [isCustomerDetailsVisible, setIsCustomerDetailsVisible] = useState(false); // For toggling customer details visibility
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios
        .get('http://localhost:8000/dashboard', {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((response) => setMessage(response.data.message))
        .catch(() => setMessage('Access denied. Please log in.'));

      axios
        .get('http://localhost:8000/api/customer-details', {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((response) => setCustomerDetails(response.data))
        .catch((error) => console.error('Error fetching customer details:', error));

      axios
        .get('http://localhost:8000/api/cities')
        .then((response) => setCities(response.data))
        .catch((error) => console.error('Error fetching cities:', error));

      axios
        .get('http://localhost:8000/api/bookings', {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((response) => setBookings(response.data))
        .catch((error) => console.error('Error fetching bookings:', error));
    } else {
      navigate('/login');
    }
  }, [navigate]);

  useEffect(() => {
    if (selectedCity) {
      axios
        .get(`http://localhost:8000/api/areas/${selectedCity}`)
        .then((response) => setAreas(response.data))
        .catch((error) => console.error('Error fetching areas:', error));
    }
  }, [selectedCity]);

  useEffect(() => {
    if (selectedArea) {
      axios
        .get(`http://localhost:8000/api/technicians/${selectedArea}`)
        .then((response) => setTechnicians(response.data.technicians))
        .catch((error) => console.error('Error fetching technicians:', error));
    }
  }, [selectedArea]);

  const handleTechnicianChange = (e) => {
    const technicianId = e.target.value;
    setSelectedTechnician(technicianId);
    if (technicianId) {
      axios
        .get(`http://localhost:8000/api/technician-details/${technicianId}`)
        .then((response) => {
          setTechnicianDetails(response.data);
        })
        .catch((error) => {
          console.error('Error fetching technician details:', error);
          setTechnicianDetails({
            experience_years: 0,
            rating: 0,
            reviews_count: 0,
            booking_count: 0,
          });
        });
    }
  };

  const handleBookingSubmit = (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (selectedTechnician && bookingDate) {
      axios
        .post(
          'http://localhost:8000/api/bookings',
          { technician_id: selectedTechnician, booking_date: bookingDate, status },
          { headers: { Authorization: `Bearer ${token}` } }
        )
        .then((response) => setBookings([...bookings, response.data]))
        .catch((error) => {
          setErrorMessage('Error creating booking. Please try again.');
          console.error(error);
        });
    } else {
      setErrorMessage('Please select a technician and a date.');
    }
  };

  const handleReviewSubmit = (booking_id) => {
    const token = localStorage.getItem('token');
    if (rating && review) {
      axios
        .put(
          `http://localhost:8000/api/bookings/${booking_id}`,
          { status: 'Completed', rating, review },
          { headers: { Authorization: `Bearer ${token}` } }
        )
        .then(() => {
          setBookings(
            bookings.map((booking) =>
              booking.booking_id === booking_id
                ? { ...booking, status: 'Completed', rating, review }
                : booking
            )
          );
        })
        .catch((error) => {
          setErrorMessage('Error updating booking. Please try again.');
          console.error(error);
        });
    } else {
      setErrorMessage('Please provide a rating and review.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const handleDeleteAccount = () => {
    const token = localStorage.getItem('token');
    if (token) {
      axios
        .delete('http://localhost:8000/delete-account', {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then(() => {
          setMessage('Account deleted successfully. Redirecting to signup...');
          localStorage.removeItem('token');
          setTimeout(() => {
            navigate('/signup');
          }, 5000);
        })
        .catch(() => {
          setMessage('Error deleting account.');
        });
    }
  };

  const handleCustomerUpdate = (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    axios
      .put('http://localhost:8000/api/customer-details', customerDetails, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(() => {
        setMessage('Customer details updated successfully!');
        setErrorMessage('');
        setIsUpdatingInfo(false);
        
      })
      .catch((error) => {
        setErrorMessage('Error updating details. Please try again.');
        console.error(error);
      });
  };

  const toggleCustomerDetails = () => {
    setIsCustomerDetailsVisible(!isCustomerDetailsVisible); // Toggle visibility
  };

  return (
    <div className="dashboard">
      <h1>Customer Dashboard</h1>
      <p>{message}</p>

      <div className="actions">
        <button onClick={handleDeleteAccount}>Delete Account</button>
        <button onClick={handleLogout}>Logout</button>
        <button onClick={() => navigate('/update-profile')}>
          Update Your Information
        </button>
      </div>

      {/* Toggle Button for Customer Details */}
      <div className="show-details-button">
        <button onClick={toggleCustomerDetails}>
          {isCustomerDetailsVisible ? 'Hide' : 'Show'} Your Details
        </button>
      </div>

      {/* Conditionally Render Customer Details */}
      {isCustomerDetailsVisible && (
        <div className="customer-details">
          <h2>Your Details</h2>
          <p><strong>Name:</strong> {customerDetails.user_name}</p>
          <p><strong>Phone Number:</strong> {customerDetails.phone_number}</p>
          <p><strong>Email:</strong> {customerDetails.email}</p>
        </div>
      )}

      <h2>Find and Book a Technician</h2>
      <form onSubmit={handleBookingSubmit}>
        <select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)}>
          <option value="">Select City</option>
          {cities.map((city) => (
            <option key={city.city_id} value={city.city_id}>
              {city.city_name}
            </option>
          ))}
        </select>

        <select value={selectedArea} onChange={(e) => setSelectedArea(e.target.value)}>
          <option value="">Select Area</option>
          {areas.map((area) => (
            <option key={area.zipcode} value={area.zipcode}>
              {area.area}
            </option>
          ))}
        </select>

        <select value={selectedTechnician} onChange={handleTechnicianChange}>
          <option value="">Select Technician</option>
          {technicians.map((technician) => (
            <option key={technician.user_id} value={technician.user_id}>
              {technician.user_name}- {technician.services}
            </option>
          ))}
        </select>

        <div>
          <h4>Technician Details</h4>
          <p><strong>Experience:</strong> {technicianDetails.experience_years} years</p>
          <p><strong>Rating:</strong> {technicianDetails.rating}</p>
          <p><strong>Reviews Count:</strong> {technicianDetails.reviews_count}</p>
          <p><strong>Bookings:</strong> {technicianDetails.booking_count}</p>
        </div>

        <input
          type="date"
          value={bookingDate}
          onChange={(e) => setBookingDate(e.target.value)}
        />
        <button type="submit">Book Technician</button>
      </form>

      {/* Booking List */}
      <h3>Your Bookings</h3>
      <ul>
        {bookings.map((booking) => (
          <li key={booking.booking_id}>
            {booking.technician_name} - {booking.booking_date} - {booking.status}
            {booking.status === 'Pending' && (
              <button onClick={() => handleReviewSubmit(booking.booking_id)}>
                Provide Review
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Dashboard;
