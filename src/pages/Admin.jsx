import React, { useState, useEffect } from 'react';
import '../styles/Admin.css';
import rateService from '../services/rateService';
import mongoService from '../services/mongoService';
import AdminCalendar from '../components/AdminCalendar';

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rates, setRates] = useState({
    twoMan: { low: 50, high: 70 },
    threeMan: { low: 75, high: 100 },
    fourMan: { low: 100, high: 130 }
  });

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

  const handleRateChange = (team, type, value) => {
    setRates(prev => ({
      ...prev,
      [team]: {
        ...prev[team],
        [type]: parseInt(value)
      }
    }));
  };

  const loadTeamRates = async () => {
    try {
      const result = await mongoService.getRates();
      if (result.success && result.rates) {
        setRates(result.rates);
      }
    } catch (error) {
      console.error('Error loading team rates:', error);
    }
  };

  const saveRates = async () => {
    try {
      const result = await mongoService.updateRates(rates);
      if (result.success) {
        alert('Rates saved successfully to MongoDB!');
      } else {
        alert('Error saving rates: ' + result.error);
      }
    } catch (error) {
      alert('Error saving rates: ' + error.message);
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
                  <label>Low Rate ($)</label>
                  <input
                    type="number"
                    value={rates.twoMan?.low || ''}
                    onChange={(e) => handleRateChange('twoMan', 'low', e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label>High Rate ($)</label>
                  <input
                    type="number"
                    value={rates.twoMan?.high || ''}
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
                    value={rates.threeMan?.low || ''}
                    onChange={(e) => handleRateChange('threeMan', 'low', e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label>High Rate ($)</label>
                  <input
                    type="number"
                    value={rates.threeMan?.high || ''}
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
                    value={rates.fourMan?.low || ''}
                    onChange={(e) => handleRateChange('fourMan', 'low', e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label>High Rate ($)</label>
                  <input
                    type="number"
                    value={rates.fourMan?.high || ''}
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