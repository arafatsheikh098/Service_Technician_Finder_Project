import React from 'react';
import './Contact.css';

const Contact = () => {
  return (
    <div className="contact-container">
      {/* <h1>Contact Us</h1> */}
      <div className="contact-details">
        <h2>Arafat Sheikh</h2>
        <p>Email: <a href="mailto:arafat.csecu@gmail.com">arafat.csecu@gmail.com</a></p>
        <p>
          Head Office: Chittagong, Bangladesh<br />
          Address: Room 218, Shaheed Abdur Rab Hall,<br />
          University of Chittagong
        </p>
      </div>
    </div>
  );
};

export default Contact;
