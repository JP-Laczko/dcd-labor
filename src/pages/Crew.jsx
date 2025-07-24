import React, { useState, useEffect } from 'react';
import '../styles/Admin.css'; // Reuse admin styles for now
import CrewCalendar from '../components/CrewCalendar';

export default function Crew() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');

  useEffect(() => {
    const authStatus = localStorage.getItem('crewAuth');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    // Simple password auth - use environment variable or default
    const crewPassword = import.meta.env.VITE_CREW_PASSWORD || 'crew';
    
    if (password === crewPassword) {
      setIsAuthenticated(true);
      localStorage.setItem('crewAuth', 'true');
    } else {
      alert('Invalid password');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('crewAuth');
  };

  if (!isAuthenticated) {
    return (
      <div className="admin-container">
        <div className="admin-login">
          <h2>Crew Login</h2>
          <form onSubmit={handleLogin}>
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
        <h1>Crew Dashboard</h1>
        <p>View all bookings and schedules</p>
        <button onClick={handleLogout} className="logout-btn">Logout</button>
      </div>

      <div className="admin-content">
        <CrewCalendar />
      </div>
    </div>
  );
}