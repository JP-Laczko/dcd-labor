import React, { useState, useEffect } from 'react';
import '../styles/Admin.css';
import rateService from '../services/rateService';
import mongoService from '../services/mongoService';

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rates, setRates] = useState({
    twoMan: { low: 50, high: 70 },
    threeMan: { low: 75, high: 100 },
    fourMan: { low: 100, high: 130 }
  });
  const [bookingsPerDay] = useState(1);
  const [_bookings, setBookings] = useState([]);
  const [_selectedDate] = useState(new Date());

  useEffect(() => {
    const authStatus = localStorage.getItem('adminAuth');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
      initializeAdminData();
    }
    
    // Load current rates
    const currentRates = rateService.getRates();
    setRates(currentRates);
  }, []);

  const initializeAdminData = async () => {
    try {
      // Initialize MongoDB connection
      await mongoService.connect();
      
      // Initialize sample data if needed
      await mongoService.initializeSampleData();
      
      // Fetch recent bookings
      const bookingResult = await mongoService.getBookings();
      if (bookingResult.success) {
        setBookings(bookingResult.bookings);
        console.log('Loaded bookings:', bookingResult.bookings.length);
      }
    } catch (error) {
      console.error('Error initializing admin data:', error);
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    // Simple auth - in production, use proper authentication
    const adminUsername = import.meta.env.VITE_ADMIN_USERNAME || 'admin';
    const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD || 'admin123';
    
    if (username === adminUsername && password === adminPassword) {
      setIsAuthenticated(true);
      localStorage.setItem('adminAuth', 'true');
    } else {
      alert('Invalid credentials');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('adminAuth');
  };

  const handleRateChange = (team, type, value) => {
    setRates(prev => ({
      ...prev,
      [team]: {
        ...prev[team],
        [type]: parseInt(value)
      }
    }));
  };

  const saveRates = async () => {
    try {
      await rateService.saveRates(rates);
      alert('Rates saved successfully!');
    } catch (error) {
      alert('Error saving rates: ' + error.message);
    }
  };

  const generateCalendar = () => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }

    // Add days of the month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(day);
    }

    return days;
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  if (!isAuthenticated) {
    return (
      <div className="admin-container">
        <div className="admin-login">
          <h2>Admin Login</h2>
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="username">Username:</label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password:</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit">Login</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>Admin Dashboard</h1>
        <button onClick={handleLogout} className="logout-btn">Logout</button>
      </div>

      <div className="admin-content">
        <div className="calendar-section">
          <h2>Booking Calendar</h2>
          <div className="calendar-header">
            <h3>{monthNames[new Date().getMonth()]} {new Date().getFullYear()}</h3>
          </div>
          <div className="calendar-grid">
            <div className="day-header">Sun</div>
            <div className="day-header">Mon</div>
            <div className="day-header">Tue</div>
            <div className="day-header">Wed</div>
            <div className="day-header">Thu</div>
            <div className="day-header">Fri</div>
            <div className="day-header">Sat</div>
            {generateCalendar().map((day, index) => (
              <div key={index} className={`calendar-day ${day ? 'active' : 'inactive'}`}>
                {day && (
                  <div className="day-content">
                    <span className="day-number">{day}</span>
                    <div className="booking-availability">
                      <span className="bookings-count">Available: {bookingsPerDay}</span>
                      <button className="adjust-bookings">Edit</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="rates-section">
          <h2>Team Rates</h2>
          <div className="rates-grid">
            <div className="rate-card">
              <h3>2-Man Team</h3>
              <div className="rate-inputs">
                <div className="input-group">
                  <label>Low Rate ($)</label>
                  <input
                    type="number"
                    value={rates.twoMan.low}
                    onChange={(e) => handleRateChange('twoMan', 'low', e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label>High Rate ($)</label>
                  <input
                    type="number"
                    value={rates.twoMan.high}
                    onChange={(e) => handleRateChange('twoMan', 'high', e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="rate-card">
              <h3>3-Man Team</h3>
              <div className="rate-inputs">
                <div className="input-group">
                  <label>Low Rate ($)</label>
                  <input
                    type="number"
                    value={rates.threeMan.low}
                    onChange={(e) => handleRateChange('threeMan', 'low', e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label>High Rate ($)</label>
                  <input
                    type="number"
                    value={rates.threeMan.high}
                    onChange={(e) => handleRateChange('threeMan', 'high', e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="rate-card">
              <h3>4-Man Team</h3>
              <div className="rate-inputs">
                <div className="input-group">
                  <label>Low Rate ($)</label>
                  <input
                    type="number"
                    value={rates.fourMan.low}
                    onChange={(e) => handleRateChange('fourMan', 'low', e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label>High Rate ($)</label>
                  <input
                    type="number"
                    value={rates.fourMan.high}
                    onChange={(e) => handleRateChange('fourMan', 'high', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
          <button onClick={saveRates} className="save-rates-btn">Save Rates</button>
        </div>
      </div>
    </div>
  );
}