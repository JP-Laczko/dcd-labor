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
  const [dailyAvailability, setDailyAvailability] = useState(new Map());
  const [bookings, setBookings] = useState([]);
  const [bookingsByDate, setBookingsByDate] = useState(new Map());
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showCrewModal, setShowCrewModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [crewCount, setCrewCount] = useState(0);

  useEffect(() => {
    const authStatus = localStorage.getItem('adminAuth');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
      initializeAdminData();
    }
    
    // Load current rates from MongoDB
    loadTeamRates();
  }, []);

  const initializeAdminData = async () => {
    try {
      console.log('🚀 Starting admin data initialization...');
      
      // Initialize MongoDB connection
      const connectionResult = await mongoService.connect();
      console.log('📡 MongoDB connection result:', connectionResult);
      console.log('📡 MongoDB isConnected:', mongoService.isConnected);
      
      // Fetch calendar availability for current month
      console.log('📅 Fetching calendar availability...');
      await fetchCalendarAvailability();
      
      // Fetch recent bookings
      const bookingResult = await mongoService.getBookings();
      if (bookingResult.success) {
        setBookings(bookingResult.bookings);
        
        // Organize bookings by date for calendar display
        const bookingMap = new Map();
        bookingResult.bookings.forEach(booking => {
          const bookingDate = booking.service?.date || booking.date;
          if (bookingDate) {
            const dateString = new Date(bookingDate).toISOString().split('T')[0];
            if (!bookingMap.has(dateString)) {
              bookingMap.set(dateString, []);
            }
            bookingMap.get(dateString).push(booking);
          }
        });
        setBookingsByDate(bookingMap);
      }
    } catch (error) {
      console.error('❌ Error initializing admin data:', error);
    }
  };

  const fetchCalendarAvailability = async () => {
    try {
      // Get calendar availability directly from MongoDB
      const calendarResult = await mongoService.getAllCalendarAvailability();
      
      const finalAvailability = new Map();
      const month = currentMonth.getMonth();
      const year = currentMonth.getFullYear();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      
      // Create map from MongoDB calendar availability data
      const calendarData = new Map();
      if (calendarResult.success && calendarResult.availability) {
        calendarResult.availability.forEach(entry => {
          calendarData.set(entry.date, entry.bookings || 0);
        });
      }
      
      // Set booking count for each day of displayed month
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dateString = date.toISOString().split('T')[0];
        
        const bookingsCount = calendarData.get(dateString) || 0;
        finalAvailability.set(dateString, bookingsCount);
      }
      
      setDailyAvailability(finalAvailability);
    } catch (error) {
      console.error('❌ Error fetching calendar availability:', error);
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
      // Initialize data immediately after login
      initializeAdminData();
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

  const generateCalendar = () => {
    const month = currentMonth.getMonth();
    const year = currentMonth.getFullYear();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
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

  const handleBookingClick = (booking) => {
    setSelectedBooking(booking);
    setShowBookingModal(true);
  };

  const closeBookingModal = () => {
    setShowBookingModal(false);
    setSelectedBooking(null);
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleEditCrews = (dateString) => {
    setSelectedDate(dateString);
    setCrewCount(dailyAvailability.get(dateString) || 0);
    setShowCrewModal(true);
  };

  const closeCrewModal = () => {
    setShowCrewModal(false);
    setSelectedDate(null);
    setCrewCount(0);
  };

  const saveCrewCount = async () => {
    try {
      console.log('🔧 Saving crew count:', { selectedDate, crewCount });
      console.log('🔧 MongoDB connection status:', mongoService.isConnected);
      
      const result = await mongoService.updateCalendarAvailability(selectedDate, 0, crewCount);
      console.log('🔧 Update result:', result);
      
      if (result.success) {
        // Update local state
        setDailyAvailability(prev => new Map(prev.set(selectedDate, crewCount)));
        closeCrewModal();
        alert('Crew count updated successfully!');
      } else {
        console.error('🔧 Update failed:', result.error);
        alert('Error updating crew count: ' + result.error);
      }
    } catch (error) {
      console.error('🔧 Exception during update:', error);
      alert('Error updating crew count: ' + error.message);
    }
  };

  const handleChargeAndRemove = async () => {
    if (!selectedBooking) return;
    
    const confirmation = window.confirm(
      `Are you sure you want to charge ${selectedBooking.customer?.name || 'this customer'} and remove this booking?\n\n` +
      `Customer: ${selectedBooking.customer?.name || 'N/A'}\n` +
      `Service Date: ${selectedBooking.service?.date || 'N/A'}\n` +
      `Payment Card: ${selectedBooking.payment?.creditCard ? `****${selectedBooking.payment.creditCard.slice(-4)}` : 'N/A'}\n\n` +
      `This action cannot be undone.`
    );
    
    if (!confirmation) return;
    
    try {
      // TODO: Implement actual payment processing
      // For now, we'll simulate the process
      alert('Charging credit card...');
      
      // Simulate payment processing delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // TODO: Replace with actual payment processing logic
      const paymentSuccess = Math.random() > 0.1; // 90% success rate for demo
      
      if (paymentSuccess) {
        // Payment successful, now remove the booking
        alert('Payment successful! Removing booking...');
        
        // TODO: Implement booking removal API call
        // For now, we'll update the booking status to 'cancelled' and mark as paid
        const updatedBooking = {
          ...selectedBooking,
          status: { ...selectedBooking.status, current: 'cancelled' },
          payment: { ...selectedBooking.payment, paid: true }
        };
        
        // Update local state by removing the booking from the display
        setBookingsByDate(prev => {
          const newMap = new Map(prev);
          const bookingDate = selectedBooking.service?.date || selectedBooking.date;
          if (bookingDate) {
            const dateString = new Date(bookingDate).toISOString().split('T')[0];
            const dayBookings = newMap.get(dateString) || [];
            const filteredBookings = dayBookings.filter(b => b.bookingId !== selectedBooking.bookingId);
            if (filteredBookings.length > 0) {
              newMap.set(dateString, filteredBookings);
            } else {
              newMap.delete(dateString);
            }
          }
          return newMap;
        });
        
        closeBookingModal();
        alert('Booking charged and removed successfully!');
      } else {
        alert('Payment failed. Please check the card information and try again.');
      }
    } catch (error) {
      alert('Error processing charge and removal: ' + error.message);
    }
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
            <button onClick={goToPreviousMonth} className="nav-button">
              &#8249;
            </button>
            <h3>{monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}</h3>
            <button onClick={goToNextMonth} className="nav-button">
              &#8250;
            </button>
          </div>
          <div className="calendar-grid">
            <div className="day-header">Sun</div>
            <div className="day-header">Mon</div>
            <div className="day-header">Tue</div>
            <div className="day-header">Wed</div>
            <div className="day-header">Thu</div>
            <div className="day-header">Fri</div>
            <div className="day-header">Sat</div>
            {generateCalendar().map((day, index) => {
              const dateString = day ? new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day).toISOString().split('T')[0] : null;
              const availableSlots = dateString ? dailyAvailability.get(dateString) || 0 : 0;
              const dayBookings = dateString ? bookingsByDate.get(dateString) || [] : [];
              
              return (
                <div key={index} className={`calendar-day ${day ? 'active' : 'inactive'}`}>
                  {day && (
                    <div className="day-content">
                      <div className="day-header">
                        <span className="day-number">{day}</span>
                        <span className="slots-available">Crews: {availableSlots}</span>
                      </div>
                      
                      <div className="bookings-list">
                        {dayBookings.length > 0 ? (
                          dayBookings.map((booking, idx) => (
                            <div 
                              key={idx} 
                              className="booking-item clickable" 
                              onClick={() => handleBookingClick(booking)}
                            >
                              <div className="customer-name">{booking.customer?.name || 'Unknown'}</div>
                              <div className="booking-details">
                                <span className="crew-size">{booking.service?.crewSize || 'N/A'}-person crew</span>
                                <span className="services">{booking.service?.services?.join(', ') || 'No services'}</span>
                              </div>
                              <div className="booking-status">
                                Status: <span className={`status-${booking.status?.current || 'unknown'}`}>
                                  {booking.status?.current || 'unknown'}
                                </span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="no-bookings">No bookings</div>
                        )}
                      </div>
                      
                      <button 
                        className="adjust-bookings"
                        onClick={() => handleEditCrews(dateString)}
                      >
                        Edit Crews
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
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

      {/* Booking Detail Modal */}
      {showBookingModal && selectedBooking && (
        <div className="modal-overlay" onClick={closeBookingModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Booking Details</h3>
              <button className="close-button" onClick={closeBookingModal}>&times;</button>
            </div>
            
            <div className="modal-body">
              <div className="booking-section">
                <h4>Customer Information</h4>
                <div className="info-grid">
                  <div className="info-item">
                    <label>Name:</label>
                    <span>{selectedBooking.customer?.name || 'N/A'}</span>
                  </div>
                  <div className="info-item">
                    <label>Email:</label>
                    <span>{selectedBooking.customer?.email || 'N/A'}</span>
                  </div>
                  <div className="info-item">
                    <label>Phone:</label>
                    <span>{selectedBooking.customer?.phone || 'N/A'}</span>
                  </div>
                  <div className="info-item">
                    <label>Address:</label>
                    <span>{selectedBooking.customer?.address || 'N/A'}</span>
                  </div>
                </div>
              </div>

              <div className="booking-section">
                <h4>Service Details</h4>
                <div className="info-grid">
                  <div className="info-item">
                    <label>Date:</label>
                    <span>{selectedBooking.service?.date || 'N/A'}</span>
                  </div>
                  <div className="info-item">
                    <label>Crew Size:</label>
                    <span>{selectedBooking.service?.crewSize || 'N/A'} person crew</span>
                  </div>
                  <div className="info-item">
                    <label>Yard Acreage:</label>
                    <span>{selectedBooking.service?.yardAcreage || 'N/A'}</span>
                  </div>
                  <div className="info-item">
                    <label>Services:</label>
                    <span>{selectedBooking.service?.services?.join(', ') || 'N/A'}</span>
                  </div>
                  <div className="info-item full-width">
                    <label>Notes:</label>
                    <span>{selectedBooking.service?.notes || 'No notes'}</span>
                  </div>
                </div>
              </div>

              <div className="booking-section">
                <h4>Payment Information</h4>
                <div className="info-grid">
                  <div className="info-item">
                    <label>Credit Card:</label>
                    <span>{selectedBooking.payment?.creditCard ? `****${selectedBooking.payment.creditCard.slice(-4)}` : 'N/A'}</span>
                  </div>
                  <div className="info-item">
                    <label>Payment Status:</label>
                    <span className={`payment-status ${selectedBooking.payment?.paid ? 'paid' : 'unpaid'}`}>
                      {selectedBooking.payment?.paid ? 'Paid' : 'Unpaid'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="booking-section">
                <h4>Booking Status</h4>
                <div className="info-grid">
                  <div className="info-item">
                    <label>Current Status:</label>
                    <span className={`status-${selectedBooking.status?.current || 'unknown'}`}>
                      {selectedBooking.status?.current || 'Unknown'}
                    </span>
                  </div>
                  <div className="info-item">
                    <label>Booking ID:</label>
                    <span>{selectedBooking.bookingId || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeBookingModal}>Close</button>
              <button className="btn-danger" onClick={handleChargeAndRemove}>Charge & Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Crews Modal */}
      {showCrewModal && selectedDate && (
        <div className="modal-overlay" onClick={closeCrewModal}>
          <div className="modal-content crew-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Crews for {new Date(selectedDate).toLocaleDateString()}</h3>
              <button className="close-button" onClick={closeCrewModal}>&times;</button>
            </div>
            
            <div className="modal-body">
              <div className="crew-input-section">
                <label htmlFor="crewCount">Number of Crews Available:</label>
                <div className="crew-counter">
                  <button 
                    className="counter-btn" 
                    onClick={() => setCrewCount(Math.max(0, crewCount - 1))}
                    disabled={crewCount <= 0}
                  >
                    -
                  </button>
                  <input
                    id="crewCount"
                    type="number"
                    value={crewCount}
                    onChange={(e) => setCrewCount(Math.max(0, parseInt(e.target.value) || 0))}
                    min="0"
                    className="crew-input"
                  />
                  <button 
                    className="counter-btn" 
                    onClick={() => setCrewCount(crewCount + 1)}
                  >
                    +
                  </button>
                </div>
                <p className="crew-help-text">
                  Set the number of crews available for this day. Use 0 to mark the day as unavailable.
                </p>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeCrewModal}>Cancel</button>
              <button className="btn-primary" onClick={saveCrewCount}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}