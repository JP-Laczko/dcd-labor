import React, { useState, useEffect } from 'react';
import '../styles/Admin.css';
import rateService from '../services/rateService';
import mongoService from '../services/mongoService';
import AdminCalendar from '../components/AdminCalendar';

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rates, setRates] = useState({});

  useEffect(() => {
    const authStatus = localStorage.getItem('adminAuth');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    }
    
    // Load current rates from MongoDB
    loadTeamRates();
  }, []);


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

  const handleRateChange = (team, value) => {
    // Convert to number, but allow empty string for display
    const numericValue = value === '' ? '' : parseInt(value) || 0;
    
    setRates(prev => ({
      ...prev,
      [team]: numericValue
    }));
  };

  const loadTeamRates = async () => {
    try {
      const result = await mongoService.getRates();
      if (result.success && result.rates) {
        setRates(result.rates);
      } else {
        // Set default rates if loading failed
        const defaultRates = {
          twoMan: 70,
          threeMan: 100,
          fourMan: 130
        };
        setRates(defaultRates);
      }
    } catch (error) {
      console.error('Error loading team rates:', error);
      // Set default rates if loading failed
      const defaultRates = {
        twoMan: 70,
        threeMan: 100,
        fourMan: 130
      };
      setRates(defaultRates);
    }
  };

  const saveRates = async () => {
    try {
      // Convert any empty strings to 0 before saving
      const normalizedRates = {
        twoMan: parseInt(rates.twoMan) || 0,
        threeMan: parseInt(rates.threeMan) || 0,
        fourMan: parseInt(rates.fourMan) || 0
      };
      
      const result = await mongoService.updateRates(normalizedRates);
      if (result.success) {
        alert('Rates saved successfully to MongoDB!');
        // Update local state with normalized values
        setRates(normalizedRates);
      } else {
        alert('Error saving rates: ' + result.error);
      }
    } catch (error) {
      alert('Error saving rates: ' + error.message);
    }
  };

  const handleCleanupPastDates = async () => {
    if (!confirm('This will permanently delete all past calendar availability entries to save database space. Bookings will be kept for records. Continue?')) {
      return;
    }
    
    try {
      const response = await fetch('/api/cleanup/past-calendar-only', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      if (result.success) {
        alert(`Cleanup successful! Deleted ${result.deleted.calendarEntries} past calendar entries.`);
      } else {
        alert('Error during cleanup: ' + result.error);
      }
    } catch (error) {
      alert('Error during cleanup: ' + error.message);
    }
  };

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
        <AdminCalendar />

        <div className="rates-section">
          <h2>Team Rates</h2>
          <div className="rates-grid">
            <div className="rate-card">
              <h3>2-Man Team</h3>
              <div className="rate-inputs">
                <div className="input-group">
                  <label>Rate ($/hour)</label>
                  <input
                    type="number"
                    value={rates.twoMan !== undefined ? rates.twoMan : ''}
                    onChange={(e) => handleRateChange('twoMan', e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="rate-card">
              <h3>3-Man Team</h3>
              <div className="rate-inputs">
                <div className="input-group">
                  <label>Rate ($/hour)</label>
                  <input
                    type="number"
                    value={rates.threeMan !== undefined ? rates.threeMan : ''}
                    onChange={(e) => handleRateChange('threeMan', e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="rate-card">
              <h3>4-Man Team</h3>
              <div className="rate-inputs">
                <div className="input-group">
                  <label>Rate ($/hour)</label>
                  <input
                    type="number"
                    value={rates.fourMan !== undefined ? rates.fourMan : ''}
                    onChange={(e) => handleRateChange('fourMan', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
          <button onClick={saveRates} className="save-rates-btn">Save Rates</button>
        </div>

        {/* Database Cleanup Section */}
        <div className="cleanup-section">
          <h2>Database Maintenance</h2>
          <div className="cleanup-card">
            <h3>Clean Up Past Dates</h3>
            <p>Remove past calendar availability entries to save database space. This keeps your booking records but deletes old availability data.</p>
            <button onClick={handleCleanupPastDates} className="cleanup-btn">
              🧹 Clean Up Past Calendar Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}