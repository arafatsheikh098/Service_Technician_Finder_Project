import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';
import profile from './download.png' ;


const TechnicianDashboard = () => {
  const [message, setMessage] = useState('');
  const [technicianDetails, setTechnicianDetails] = useState({
    user_name: '',
    phone_number: '',
    email: '',
    experienced_year: 0,
    rating: 0,
    profile_picture: '',
  });
  const [pendingBookings, setPendingBookings] = useState([]); 
  const [bookingHistory, setBookingHistory] = useState([]); 
  const [errorMessage, setErrorMessage] = useState('');
  const [isTechnicianDetailsVisible, setIsTechnicianDetailsVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false); 
  const [updatedInfo, setUpdatedInfo] = useState({
    user_name: '',
    phone_number: '',
    email: '',
  });
  const [updateSuccessMessage, setUpdateSuccessMessage] = useState('');
  const [bestTechnician, setBestTechnician] = useState(null);

  const navigate = useNavigate();
  

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      
      axios
        .get('http://localhost:8000/technician-details', {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((response) => {
          setTechnicianDetails(response.data.technicianDetails || {});
          setUpdatedInfo({
            user_name: response.data.technicianDetails.user_name,
            phone_number: response.data.technicianDetails.phone_number,
            email: response.data.technicianDetails.email,
          });
        })
        .catch(() => {
          setErrorMessage('Error fetching technician details.');
        });

     
      axios
        .get('http://localhost:8000/pending-bookings', {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((response) => {
          setPendingBookings(response.data.pendingBookings || []);
        })
        .catch(() => {
          setErrorMessage('Error fetching pending bookings.');
        });

      
      axios
        .get('http://localhost:8000/booking-history', {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((response) => {
          setBookingHistory(response.data.bookingHistory || []);
        })
        .catch(() => {
          setErrorMessage('Error fetching booking history.');
        });

        axios
            .get('http://localhost:8000/best-technician', {
                headers: { Authorization: `Bearer ${token}` },
            })
            .then((response) => {
                setBestTechnician(response.data);
            })
            .catch(() => {
                setErrorMessage('Error fetching best technician.');
            });
        
    } else {
      navigate('/login');
    }
  }, [navigate]);

  const toggleTechnicianDetails = () => {
    setIsTechnicianDetailsVisible(!isTechnicianDetailsVisible);
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
          setErrorMessage('Error deleting account.');
        });
    }
  };

  
  const handleUpdateInfo = (e) => {
    e.preventDefault();

    const token = localStorage.getItem('token');
    if (token) {
      axios
        .put('http://localhost:8000/update-profile', updatedInfo, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((response) => {
          setMessage('Profile updated successfully!');
          setTechnicianDetails(updatedInfo); 
          setUpdateSuccessMessage('Information updated successfully!');
          setIsEditing(false); 
        })
        .catch(() => {
          setErrorMessage('Error updating profile.');
        });
    }
  };

 
  const handleStatusChange = (bookingId, newStatus) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    axios
      .put(
        `http://localhost:8000/api/bookings/${bookingId}`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      .then((response) => {
        
        setPendingBookings((prevBookings) =>
          prevBookings.map((booking) =>
            booking.booking_id === bookingId ? { ...booking, status: newStatus } : booking
          )
        );
        alert('Booking status updated successfully');
      })
      .catch((error) => {
        console.error('Error updating status:', error);
        alert('Error updating status');
      });
  };
// console.log(technicianDetails.profile_picture);
  return (
    <div className="dashboard">
      <h1>Technician Dashboard</h1>
      <p>{message}</p>
      <div className="dash">
 
  {technicianDetails.profile_picture ? (
    <img
    src={`http://localhost:8000/uploads/${technicianDetails.profile_picture}`}
    alt="Profile"
    style={{ width: '100px', height: '100px', borderRadius: '50%' }}
      className="profile-picture"
    />
  ) : (
    <img
      src={profile} 
      alt="Default Profile"
      className="profile-picture"
    />
  )}
</div>

      {errorMessage && <p className="error-message">{errorMessage}</p>}

      <div className="actions">
        <button onClick={handleDeleteAccount}>Delete Account</button>
        <button onClick={handleLogout}>Logout</button>
      </div>

      <div className="show-details-button">
        <button onClick={toggleTechnicianDetails}>
          {isTechnicianDetailsVisible ? 'Hide' : 'Show'} Your Details
        </button>
      </div>
      <div className="best-technician">
  <h3>Best Technician of Last Month</h3>
  {bestTechnician ? (
    <div>
      <p><strong>Name:</strong> {bestTechnician.user_name}</p>
      <p><strong>Experience:</strong> {bestTechnician.experienced_year} years</p>
      <p><strong>Average Rating:</strong> {bestTechnician.avg_rating}</p>
      <p><strong>Total Bookings:</strong> {bestTechnician.total_bookings}</p>
    </div>
  ) : (
    <p>No data available.</p>
  )}
</div>
      {isTechnicianDetailsVisible && (
        <div className="technician-details">
          <h2>Your Details</h2>
          {isEditing ? (
            <form onSubmit={handleUpdateInfo}>
              <div>
                <label>Name:</label>
                <input
                  type="text"
                  value={updatedInfo.user_name}
                  onChange={(e) => setUpdatedInfo({ ...updatedInfo, user_name: e.target.value })}
                />
              </div>
              <div>
                <label>Phone Number:</label>
                <input
                  type="text"
                  value={updatedInfo.phone_number}
                  onChange={(e) => setUpdatedInfo({ ...updatedInfo, phone_number: e.target.value })}
                />
              </div>
              <div>
                <label>Email:</label>
                <input
                  type="email"
                  value={updatedInfo.email}
                  onChange={(e) => setUpdatedInfo({ ...updatedInfo, email: e.target.value })}
                />
              </div>
              <button type="submit">Update</button>
              <button type="button" onClick={() => setIsEditing(false)}>Cancel</button>
            </form>
          ) : (
            <>
              <p><strong>Name:</strong> {technicianDetails.user_name}</p>
              <p><strong>Phone Number:</strong> {technicianDetails.phone_number}</p>
              <p><strong>Email:</strong> {technicianDetails.email}</p>
              <p><strong>Experience:</strong> {technicianDetails.experienced_year} years</p>
              <p><strong>Rating:</strong> {technicianDetails.rating}</p>
              <button onClick={() => setIsEditing(true)}>Edit Info</button>
            </>
          )}
        </div>
      )}
      
     <div className="pending-bookings" >
      <h2>Your Pending Bookings</h2>
      {pendingBookings && pendingBookings.length > 0 ? (
        <ul>
          {pendingBookings.map((booking) => (
            <li key={booking.booking_id}>
              <strong>Customer:</strong> {booking.customer_name} <br />
              <strong>Phone Number:</strong> {booking.customer_phone_number} <br />
              <strong>Date:</strong> {booking.booking_date} <br />
              <strong>Status:</strong> 
              <select
                value={booking.status}
                onChange={(e) => handleStatusChange(booking.booking_id, e.target.value)}
              >
                <option value="Pending">Pending</option>
                <option value="Confirmed">Confirmed</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
              <br />
            </li>
          ))}
        </ul>
      ) : (
        <p>No pending bookings at the moment.</p>
      )}
      </div>

      <div className="completed-bookings">
      <h2>Your Bookings History</h2>
      {bookingHistory && bookingHistory.length > 0 ? (
        <ul>
          {bookingHistory.map((history) => (
            <li key={history.booking_id}>
              <strong>Customer:</strong> {history.customer_name} <br />
              <strong>Phone Number:</strong> {history.customer_phone_number} <br />
              <strong>Date:</strong> {history.booking_date} <br />
              <strong>Rating:</strong> {history.rating || 'No rating provided'} <br />
              <strong>Review:</strong> {history.review || 'No review provided'} <br />
              <strong>Status:</strong> {history.status} <br />
            </li>
          ))}
        </ul>
      ) : (
        <p>No booking history available.</p>
      )}
      </div>
    </div>
  );
};

export default TechnicianDashboard;
