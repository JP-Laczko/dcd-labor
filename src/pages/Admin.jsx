import React, { useState, useEffect } from 'react';
import '../styles/Admin.css';
import rateService from '../services/rateService';
import mongoService from '../services/mongoService';
import AdminCalendarTimeSlots from '../components/AdminCalendarTimeSlots';
import testBookingCommands from '../utils/testBookingCommands';

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rates, setRates] = useState({});
  const [testBookingStatus, setTestBookingStatus] = useState('');

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

  // Test Booking Command Handlers
  const executeTestBookingCommand = async (commandFunction, commandName) => {
    setTestBookingStatus(`Running ${commandName}...`);
    try {
      const result = await commandFunction();
      if (result.success) {
        setTestBookingStatus(`✅ ${commandName} completed successfully!`);
        setTimeout(() => setTestBookingStatus(''), 3000);
      } else {
        setTestBookingStatus(`❌ ${commandName} failed: ${result.error}`);
        setTimeout(() => setTestBookingStatus(''), 5000);
      }
      return result;
    } catch (error) {
      setTestBookingStatus(`❌ ${commandName} error: ${error.message}`);
      setTimeout(() => setTestBookingStatus(''), 5000);
      console.error('Test booking command error:', error);
    }
  };

  const handleTest2ManHourly = () => executeTestBookingCommand(
    testBookingCommands.createTest2ManHourlyBooking,
    '2-Man Hourly Booking'
  );

  const handleTest3ManEstimate = () => executeTestBookingCommand(
    testBookingCommands.createTest3ManEstimateBooking,
    '3-Man Estimate Booking'
  );

  const handleTest4ManHourly = () => executeTestBookingCommand(
    testBookingCommands.createTest4ManHourlyBooking,
    '4-Man Hourly Booking'
  );

  const handleBulkTestBookings = () => executeTestBookingCommand(
    () => testBookingCommands.createBulkTestBookings(5),
    'Bulk Test Bookings (5)'
  );

  const handleNextWeekBookings = () => executeTestBookingCommand(
    testBookingCommands.createTestBookingsForNextWeek,
    'Next Week Test Bookings'
  );

  const handleClearTestBookings = () => {
    if (confirm('This will clear all test bookings from localStorage only. MongoDB bookings need to be deleted manually. Continue?')) {
      executeTestBookingCommand(
        testBookingCommands.clearAllTestBookings,
        'Clear Test Bookings'
      );
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
        <AdminCalendarTimeSlots />

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

        {/* Test Booking Commands Section */}
        <div className="test-booking-section">
          <h2>Test Booking Commands</h2>
          <p>Create test bookings to verify the system is working properly. These commands integrate with your booking system and demonstrate all functionality.</p>
          
          {testBookingStatus && (
            <div className="test-booking-status">
              {testBookingStatus}
            </div>
          )}
          
          <div className="test-commands-grid">
            <div className="test-command-card">
              <h3>Individual Test Bookings</h3>
              <p>Create single test bookings with different crew sizes and service types</p>
              <div className="test-command-buttons">
                <button onClick={handleTest2ManHourly} className="test-cmd-btn">
                  🧪 2-Man Crew (Hourly)
                </button>
                <button onClick={handleTest3ManEstimate} className="test-cmd-btn">
                  🧪 3-Man Crew (Estimate)
                </button>
                <button onClick={handleTest4ManHourly} className="test-cmd-btn">
                  🧪 4-Man Crew (Hourly)
                </button>
              </div>
            </div>

            <div className="test-command-card">
              <h3>Bulk Test Data</h3>
              <p>Create multiple bookings at once for comprehensive testing</p>
              <div className="test-command-buttons">
                <button onClick={handleBulkTestBookings} className="test-cmd-btn bulk">
                  📋 Create 5 Test Bookings
                </button>
                <button onClick={handleNextWeekBookings} className="test-cmd-btn bulk">
                  📅 Fill Next Week with Bookings
                </button>
              </div>
            </div>

            <div className="test-command-card">
              <h3>Utilities</h3>
              <p>Development utilities for managing test data</p>
              <div className="test-command-buttons">
                <button onClick={handleClearTestBookings} className="test-cmd-btn danger">
                  🗑️ Clear Test Bookings (localStorage)
                </button>
              </div>
            </div>
          </div>

          <div className="test-command-info">
            <h4>📖 Browser Console Commands</h4>
            <p>You can also use these commands directly in the browser console:</p>
            <ul>
              <li><code>testBookingCommands.createTest2ManHourlyBooking()</code></li>
              <li><code>testBookingCommands.createTest3ManEstimateBooking()</code></li>
              <li><code>testBookingCommands.createBulkTestBookings(10)</code></li>
              <li><code>testBookingCommands.createCustomTestBooking({'{crewSize: 3, serviceType: "hourly"}'})</code></li>
            </ul>
          </div>
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