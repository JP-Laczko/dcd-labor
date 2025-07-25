import { useState, useEffect } from "react";
import "../styles/Admin.css";
import mongoService from "../services/mongoService";
import CrewBookingModal from "./CrewBookingModal";

export default function CrewCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dailyAvailability, setDailyAvailability] = useState(new Map());
  const [dailyBookings, setDailyBookings] = useState(new Map());
  const [expandedBooking, setExpandedBooking] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);

  useEffect(() => {
    // Initialize MongoDB connection and fetch availability
    const initializeCalendar = async () => {
      console.log('📅 CrewCalendar: Initializing calendar...');
      try {
        const connectionResult = await mongoService.connect();
        console.log('📅 CrewCalendar: MongoDB connection result:', connectionResult);
        await fetchAvailability();
        await fetchBookings();
      } catch (error) {
        console.error('📅 CrewCalendar: Initialization error:', error);
        await fetchAvailability(); // Try to fetch anyway (will use localStorage fallback)
        await fetchBookings();
      }
    };
    
    initializeCalendar();
  }, [currentDate]);

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
      console.log('📅 Bookings data:', bookingsResult);
      
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
        const remainingSlots = Math.max(0, allowedBookings - actualBookings);
        
        availability.set(dateString, remainingSlots);
      }
      
      console.log('📅 Final availability for today + next 14 days:', Object.fromEntries(availability));
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
      console.log('📅 Bookings data:', bookingsResult);
      
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

  // Read-only booking click handler - open modal for details
  const handleBookingClick = (e, booking) => {
    e.stopPropagation(); // Prevent date click
    
    if (isMobile) {
      // On mobile, first expand/collapse, then modal on second tap
      const bookingKey = `${booking.bookingId}_${booking.service?.date || booking.date}`;
      if (expandedBooking === bookingKey) {
        // Second tap - open modal
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

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedDate(null);
    setSelectedBooking(null);
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

  return (
    <div className="calendar-section">
      <h2>Booking Schedule (View Only)</h2>
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
            <div key={index} className="calendar-day active crew-view">
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
                              {isMobile && !isExpanded && ' (tap for details)'}
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
                            {isExpanded && (
                              <div className="expanded-details">
                                <div className="detail-item">
                                  <strong>Phone:</strong> {booking.customer?.phone || 'N/A'}
                                </div>
                                <div className="detail-item">
                                  <strong>Email:</strong> {booking.customer?.email || 'N/A'}
                                </div>
                                <div className="detail-item">
                                  <strong>Address:</strong> {booking.customer?.address || booking.service?.address || 'N/A'}
                                </div>
                                {booking.service?.preferredHour && (
                                  <div className="detail-item">
                                    <strong>Preferred Hour:</strong> {booking.service.preferredHour.charAt(0).toUpperCase() + booking.service.preferredHour.slice(1).replace('-', ' ')}
                                  </div>
                                )}
                                {booking.service?.notes && (
                                  <div className="detail-item">
                                    <strong>Notes:</strong> {booking.service.notes}
                                  </div>
                                )}
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
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Crew Booking Modal - View Only */}
      <CrewBookingModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        selectedDate={selectedDate}
        booking={selectedBooking}
      />
    </div>
  );
}