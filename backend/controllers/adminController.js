const bcrypt = require('bcrypt');
const db = require('../config/db');

const createTechnician = (req, res) => {
    const { user_name, password, phone_number, email, experienced_year, location, service_names } = req.body;
    const profile_picture = req.file ? req.file.filename : null; // Get the file name if uploaded
    console.log(profile_picture);

    if (!user_name || !password || !email || !experienced_year || !location || !service_names) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
            console.error('Error hashing password:', err);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }

        const userQuery = `
            INSERT INTO User (user_name, password, phone_number, email, role) 
            VALUES (?, ?, ?, ?, 'Technician')
        `;

        db.query(userQuery, [user_name, hashedPassword, phone_number, email], (err, userResult) => {
            if (err) {
                console.error('Error inserting into User:', err);
                return res.status(500).json({ success: false, message: 'Error creating technician user.' });
            }

            const user_id = userResult.insertId;

            const technicianQuery = `
                INSERT INTO Technician (user_id, experienced_year, profile_picture, zipcode) 
                VALUES (?, ?, ?, (SELECT zipcode FROM Location WHERE area = ?))
            `;

            db.query(technicianQuery, [user_id, experienced_year, profile_picture, location], (err) => {
                if (err) {
                    console.error('Error inserting into Technician:', err);
                    return res.status(500).json({ success: false, message: 'Error creating technician details.' });
                }

                const serviceQueries = service_names.map((serviceName) => `
                    INSERT INTO Offers (technician_id, service_id) 
                    VALUES (${user_id}, (SELECT service_id FROM Service WHERE service_name = '${serviceName}'))
                `);

                const allQueries = serviceQueries.join('; ');

                db.query(allQueries, (err) => {
                    if (err) {
                        console.error('Error inserting into Offers:', err);
                        return res.status(500).json({ success: false, message: 'Error adding technician services.' });
                    }

                    res.status(201).json({ success: true, message: 'Technician created successfully!' });
                });
            });
        });
    });
};
// all technician info 
const TechnicianInfo= (req, res) => {
    const query = `
     SELECT
          u.user_name,
          u.email,
          t.user_id AS technician_id,
          AVG(b.rating) AS average_rating,
          COUNT(b.booking_id) AS total_bookings
        FROM User u
        JOIN Technician t ON u.user_id = t.user_id
        LEFT JOIN Booking b ON t.user_id = b.technician_id
        WHERE u.role = 'Technician'
        GROUP BY t.user_id, u.user_name, u.email
        ORDER BY u.user_name;
    `;
    db.query(query, (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error fetching technicians' });
      }
     
      res.json(results);
      
    });
  };
  // DELETE /api/technicians/:id - Delete technician by ID
const deleteTechnician= (req, res) => {
    const technicianId = req.params.technicianId;
    console.log(technicianId);
    
    const deleteTechnicianQuery = `
      DELETE FROM user WHERE user_id = ?;
    `;
  
    db.query(deleteTechnicianQuery, [technicianId], (err, result) => {
      if (err) {
        console.error('Error deleting technician:', err);
        return res.status(500).send('Error deleting technician');
      }
  
      if (result.affectedRows === 0) {
        return res.status(404).send('Technician not found');
      }
  
      res.status(200).send('Technician deleted successfully');
    });
  };
  

module.exports = {
    createTechnician,TechnicianInfo,deleteTechnician
};