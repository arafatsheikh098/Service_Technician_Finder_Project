import React from 'react';
import './Services.css';

const Services = () => {
  const services = [
    'Car Mechanic',
    'Painter',
    'Electrician',
    'Plumber',
    'HVAC Technician',
    'Gardener',
    'Cleaning Service',
    'Carpenter',

  ];

  return (
    <div className="services-container">
      <h1>Services We Provide</h1>
      <ul className="services-list">
        {services.map((service, index) => (
          <li key={index} className="service-item">
            {service}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Services;
