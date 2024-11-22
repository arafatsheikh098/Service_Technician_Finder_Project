import React from 'react';
import { useLocation } from 'react-router-dom';

const Results = () => {
  const location = useLocation();
  const { cityId, area } = location.state || {};

  return (
    <div>
      <h1>Technicians in {area}</h1>
      <p>City ID: {cityId}</p>
      {/* Add code to fetch and display technicians based on cityId and area */}
    </div>
  );
};

export default Results;
