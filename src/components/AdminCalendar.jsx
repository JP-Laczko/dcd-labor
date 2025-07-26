import { useState, useEffect } from "react";
import "../styles/Admin.css";
import mongoService from "../services/mongoService";
import BookingModal from "./BookingModal";
import SquareFinalPayment from "./SquareFinalPayment";
import timeSlotUtils from "../utils/timeSlotUtils";

export default function AdminCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dailyAvailability, setDailyAvailability] = useState(new Map());
  const [dailyBookings, setDailyBookings] = useState(new Map());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showTimeSlotsModal, setShowTimeSlotsModal] = useState(false);
  const [selectedTimeSlotsDate, setSelectedTimeSlotsDate] = useState(null);
  const [timeSlots, setTimeSlots] = useState([]);
  const [expandedBooking, setExpandedBooking] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [showFinalPaymentModal, setShowFinalPaymentModal] = useState(false);
  const [selectedBookingForPayment, setSelectedBookingForPayment] = useState(null);
  const [rates, setRates] = useState({});

  useEffect(() => {
    // Initialize MongoDB connection and fetch availability
    const initializeCalendar = async () => {
      console.log('📅 AdminCalendar: Initializing calendar...');
      try {
        const connectionResult = await mongoService.connect();
        console.log('📅 AdminCalendar: MongoDB connection result:', connectionResult);
        await fetchAvailability();
        await fetchBookings();
        await loadRates();
      } catch (error) {
        console.error('📅 AdminCalendar: Initialization error:', error);
        await fetchAvailability(); // Try to fetch anyway (will use localStorage fallback)
        await fetchBookings();
        await loadRates();
      }
    };
    
    initializeCalendar();
  }, [currentDate]);

  const loadRates = async () => {
    try {
      const ratesResult = await mongoService.getRates();
      if (ratesResult.success) {
        setRates(ratesResult.rates);
      } else {
        // Fallback to default rates
        setRates({
          twoMan: 85,
          threeMan: 117,
          fourMan: 140
        });
      }
    } catch (error) {
      console.error('Error loading rates:', error);
      setRates({
        twoMan: 85,
        threeMan: 117,
        fourMan: 140
      });
    }
  };

  useEffect(() => {
    // Handle window resize for mobile detection
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchAvailability = async () => {
    try {
      // Step 1: Start with all days unavailable (0)
      const availability = new Map();
      const today = new Date();
      
      // Initialize today + next 2 weeks as unavailable
      for (let i = 0; i <= 14; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const dateString = date.toISOString().split('T')[0];
        availability.set(dateString, 0); // Start unavailable
      }
      
      // Step 2: Get all calendar availability entries
      const calendarResult = await mongoService.getAllCalendarAvailability();
      console.log('📅 Calendar availability data:', calendarResult);
      
      const allowedBookingsPerDay = new Map();
      if (calendarResult.success && calendarResult.availability) {
        calendarResult.availability.forEach(entry => {
          allowedBookingsPerDay.set(entry.date, entry.bookings || 0);
        });
      }
      
      // Step 3: Get actual bookings count per day
      const bookingsResult = await mongoService.getBookings();
      
      const actualBookingsPerDay = new Map();
      if (bookingsResult.success && bookingsResult.bookings) {
        bookingsResult.bookings.forEach(booking => {
          const bookingDate = new Date(booking.service?.date || booking.date);
          const dateString = bookingDate.toISOString().split('T')[0];
          
          const currentCount = actualBookingsPerDay.get(dateString) || 0;
          actualBookingsPerDay.set(dateString, currentCount + 1);
        });
      }
      
      // Step 4: Calculate final availability
      for (let i = 0; i <= 14; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const dateString = date.toISOString().split('T')[0];
        
        const allowedBookings = allowedBookingsPerDay.get(dateString) || 0;
        const actualBookings = actualBookingsPerDay.get(dateString) || 0;
        
        // Admin page should show total allowed bookings (crew count), not remaining slots
        availability.set(dateString, allowedBookings);
      }
      
      setDailyAvailability(availability);
    } catch (error) {
      console.error('❌ Calendar: Error fetching calendar availability:', error);
      
      // Fallback: all days unavailable
      const fallbackAvailability = new Map();
      const today = new Date();
      
      for (let i = 0; i <= 14; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const dateString = date.toISOString().split('T')[0];
        fallbackAvailability.set(dateString, 0); // All unavailable on error
      }
      
      setDailyAvailability(fallbackAvailability);
    }
  };

  const fetchBookings = async () => {
    try {
      const bookingsResult = await mongoService.getBookings();
      
      const bookingsByDate = new Map();
      if (bookingsResult.success && bookingsResult.bookings) {
        bookingsResult.bookings.forEach(booking => {
          const bookingDate = new Date(booking.service?.date || booking.date);
          const dateString = bookingDate.toISOString().split('T')[0];
          
          if (!bookingsByDate.has(dateString)) {
            bookingsByDate.set(dateString, []);
          }
          bookingsByDate.get(dateString).push(booking);
        });
      }
      
      setDailyBookings(bookingsByDate);
    } catch (error) {
      console.error('❌ Calendar: Error fetching bookings:', error);
      setDailyBookings(new Map());
    }
  };

  const handleDateClick = (date) => {
    setSelectedDate(date);
    setSelectedBooking(null); // New booking
    setIsModalOpen(true);
  };

  const handleBookingClick = (e, booking) => {
    e.stopPropagation(); // Prevent date click
    
    if (isMobile) {
      // On mobile, first expand/collapse booking details
      const bookingKey = `${booking.bookingId}_${booking.service?.date || booking.date}`;
      if (expandedBooking === bookingKey) {
        // If already expanded, open modal
        setSelectedDate(new Date(booking.service?.date || booking.date));
        setSelectedBooking(booking);
        setIsModalOpen(true);
        setExpandedBooking(null);
      } else {
        // First tap - expand details
        setExpandedBooking(bookingKey);
      }
    } else {
      // On desktop, directly open modal
      setSelectedDate(new Date(booking.service?.date || booking.date));
      setSelectedBooking(booking);
      setIsModalOpen(true);
    }
  };

  const handleBookingChange = async () => {
    // Refresh calendar data when bookings change
    await fetchAvailability();
    await fetchBookings();
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedDate(null);
    setSelectedBooking(null);
  };

  const handleEditCrews = (e, dateString) => {
    e.stopPropagation(); // Prevent day click
    setSelectedCrewDate(dateString);
    setCrewCount(dailyAvailability.get(dateString) || 0);
    setShowCrewModal(true);
  };

  const closeCrewModal = () => {
    setShowCrewModal(false);
    setSelectedCrewDate(null);
    setCrewCount(0);
  };

  const saveCrewCount = async () => {
    try {
      console.log('🔧 Saving crew count:', { selectedCrewDate, crewCount });
      
      const result = await mongoService.updateCalendarAvailability(selectedCrewDate, 0, crewCount);
      console.log('🔧 Update result:', result);
      
      if (result.success) {
        // Update local state
        setDailyAvailability(prev => new Map(prev.set(selectedCrewDate, crewCount)));
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

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];

    // Add empty cells for days before the first day of the month
    const startingDayOfWeek = firstDay.getDay();
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const hasAvailability = (date) => {
    const dateString = date.toISOString().split('T')[0];
    return dailyAvailability.has(dateString) && dailyAvailability.get(dateString) > 0;
  };

  const isPastDate = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const formatMonthYear = (date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const days = getDaysInMonth(currentDate);
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <>
      <div className="calendar-section">
        <h2>Booking Management Calendar</h2>
        <div className="calendar-header">
          <button onClick={goToPreviousMonth} className="nav-button">
            &#8249;
          </button>
          <h3>{formatMonthYear(currentDate)}</h3>
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
          {days.map((date, index) => {
            if (!date) {
              return <div key={index} className="calendar-day inactive"></div>;
            }

            const dateString = date.toISOString().split('T')[0];
            const availableSlots = dailyAvailability.get(dateString) || 0;
            const dayBookings = dailyBookings.get(dateString) || [];
            

            return (
              <div key={index} className="calendar-day active" onClick={() => handleDateClick(date)}>
                {/* Day number at the very top */}
                <div className="day-number">{date.getDate()}</div>
                
                <div className="day-content">
                  <div className="day-header">
                    <div className="slots-available">
                      <span className="crew-label">Crews</span>
                      <span className="crew-number">{availableSlots}</span>
                    </div>
                  </div>
                  
                  <div className="bookings-list">
                    {dayBookings.length > 0 ? (
                      isMobile && dayBookings.length > 2 ? (
                        // Mobile: Show count indicator for days with many bookings
                        <div className="mobile-booking-summary">
                          <div 
                            className="mobile-booking-count"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Show first booking on tap
                              handleBookingClick(e, dayBookings[0]);
                            }}
                          >
                            {dayBookings.length}
                          </div>
                          <div className="booking-count-text">
                            {dayBookings.length} booking{dayBookings.length > 1 ? 's' : ''}
                          </div>
                        </div>
                      ) : (
                        // Normal view: Show individual bookings
                        dayBookings.map((booking, idx) => {
                          const bookingKey = `${booking.bookingId}_${booking.service?.date || booking.date}`;
                          const isExpanded = expandedBooking === bookingKey;
                          
                          return (
                            <div 
                              key={booking.bookingId || idx} 
                              className={`booking-item clickable ${isExpanded ? 'expanded' : ''}`}
                              onClick={(e) => handleBookingClick(e, booking)}
                            >
                              <div className="customer-name">
                                {booking.customer?.name || booking.name || 'Unknown'}
                                {isMobile && !isExpanded && ' (tap to expand)'}
                              </div>
                              <div className="booking-details">
                                <span className="crew-size">{booking.service?.crewSize || 'N/A'}-person crew</span>
                                <span className="services">{booking.service?.services?.join(', ') || 'No services'}</span>
                              </div>
                              <div className="booking-status">
                                Status: <span className={`status-${booking.status?.current || 'unknown'}`}>
                                  {booking.status?.current || 'unknown'}
                                </span>
                              </div>
                              {isMobile && isExpanded && (
                                <div style={{fontSize: '8px', color: '#666', marginTop: '2px'}}>
                                  Tap again to view/edit
                                </div>
                              )}
                            </div>
                          );
                        })
                      )
                    ) : (
                      <div className="no-bookings">No bookings</div>
                    )}
                  </div>
                  
                  <button 
                    className="adjust-bookings"
                    onClick={(e) => handleEditCrews(e, dateString)}
                  >
                    Edit Crews
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <BookingModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        selectedDate={selectedDate}
        booking={selectedBooking}
        onBookingChange={handleBookingChange}
        onChargeClick={(booking) => {
          setSelectedBookingForPayment(booking);
          setShowFinalPaymentModal(true);
          setIsModalOpen(false); // Close booking modal
        }}
      />

      {/* Edit Crews Modal */}
      {showCrewModal && selectedCrewDate && (
        <div className="modal-overlay" onClick={closeCrewModal}>
          <div className="modal-content crew-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Crews for {new Date(selectedCrewDate).toLocaleDateString()}</h3>
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

      <SquareFinalPayment
        isOpen={showFinalPaymentModal}
        onClose={() => {
          setShowFinalPaymentModal(false);
          setSelectedBookingForPayment(null);
        }}
        booking={selectedBookingForPayment}
        rates={rates}
        onSuccess={(result) => {
          console.log('Payment completed:', result);
          setShowFinalPaymentModal(false);
          setSelectedBookingForPayment(null);
          // Refresh calendar data
          handleBookingChange();
        }}
      />
    </>
  );
}