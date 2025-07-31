import { useState, useEffect } from "react";
import "../styles/CalendarSection.css";
import mongoService from "../services/mongoService";
import PaymentBookingModal from "./PaymentBookingModal";

export default function CalendarSection() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dailyAvailability, setDailyAvailability] = useState(new Map());
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [hasUserNavigated, setHasUserNavigated] = useState(false);

  useEffect(() => {
    // Initialize MongoDB connection and fetch availability
    const initializeCalendar = async () => {
      console.log('📅 CalendarSection: Initializing calendar...');
      try {
        const connectionResult = await mongoService.connect();
        console.log('📅 CalendarSection: MongoDB connection status:', connectionResult ? 'connected' : 'failed');
        await fetchAvailability();
      } catch (error) {
        console.error('📅 CalendarSection: Initialization error:', error);
        await fetchAvailability(); // Try to fetch anyway (will use localStorage fallback)
      }
    };
    
    initializeCalendar();
  }, [currentDate]);

  // Check if today is the last day of the month and adjust currentDate accordingly
  const getDisplayDate = () => {
    const today = new Date();
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    // Only apply the "show next month" logic if user hasn't manually navigated
    if (!hasUserNavigated && 
        today.getDate() === lastDayOfMonth.getDate() && 
        currentDate.getMonth() === today.getMonth() && 
        currentDate.getFullYear() === today.getFullYear()) {
      return new Date(today.getFullYear(), today.getMonth() + 1, 1);
    }
    
    return currentDate;
  };

  const fetchAvailability = async () => {
    try {
      // Step 1: Start with all days unavailable (0)
      const availability = new Map();
      const today = new Date();
      
      // Initialize next 2 weeks as unavailable
      for (let i = 1; i <= 14; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const dateString = date.toISOString().split('T')[0];
        availability.set(dateString, 0); // Start unavailable
      }
      
      // Step 2: Get all calendar availability entries
      const calendarResult = await mongoService.getAllCalendarAvailability();
      console.log('📅 Calendar availability data received');
      
      const allowedBookingsPerDay = new Map();
      if (calendarResult.success && calendarResult.availability) {
        calendarResult.availability.forEach(entry => {
          allowedBookingsPerDay.set(entry.date, entry.bookings || 0);
        });
      }
      
      // Step 3: Get all bookings and count actual bookings per day
      const bookingsResult = await mongoService.getBookings();
      
      const actualBookingsPerDay = new Map();
      if (bookingsResult.success && bookingsResult.bookings) {
        bookingsResult.bookings.forEach(booking => {
          const bookingDate = booking.service?.date || booking.date;
          if (bookingDate) {
            const dateString = new Date(bookingDate).toISOString().split('T')[0];
            const currentCount = actualBookingsPerDay.get(dateString) || 0;
            actualBookingsPerDay.set(dateString, currentCount + 1);
          }
        });
      }
      
      // Step 4: Mark days available if actual bookings < allowed bookings
      const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      for (let i = 1; i <= 14; i++) {
        const date = new Date(todayLocal);
        date.setDate(todayLocal.getDate() + i);
        const dateString = date.toISOString().split('T')[0];
        
        const allowedBookings = allowedBookingsPerDay.get(dateString) || 0;
        const actualBookings = actualBookingsPerDay.get(dateString) || 0;
        
        // Available if actual bookings < allowed bookings AND allowedBookings > 0
        const isAvailable = (allowedBookings > 0 && actualBookings < allowedBookings) ? 1 : 0;
        
        // Use consistent date format (ISO string)
        availability.set(dateString, isAvailable);
      }
      setDailyAvailability(availability);
    } catch (error) {
      console.error('❌ Calendar: Error fetching calendar availability:', error);
      
      // Fallback: all days unavailable
      const fallbackAvailability = new Map();
      const today = new Date();
      
      for (let i = 1; i <= 14; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const dateString = date.toISOString().split('T')[0];
        fallbackAvailability.set(dateString, 0); // All unavailable on error
      }
      
      setDailyAvailability(fallbackAvailability);
    }
  };

  const handleDateClick = (date) => {
    if (!date || !hasAvailability(date) || isPastDate(date)) return;
    
    setSelectedDate(date);
    setIsBookingModalOpen(true);
  };

  const handleBookingChange = () => {
    // Refresh availability when a booking is made
    fetchAvailability();
  };

  const handleCloseModal = () => {
    setIsBookingModalOpen(false);
    setSelectedDate(null);
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
    setHasUserNavigated(true);
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setHasUserNavigated(true);
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const displayDate = getDisplayDate();
  const days = getDaysInMonth(displayDate);
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <section className="calendar-section">
      <div className="calendar-container">
        <h2>Schedule Your Service</h2>
        <p>Click on an available date to book your service</p>
        
        <div className="calendar">
          <div className="calendar-header">
            <button onClick={goToPreviousMonth} className="nav-button">
              &#8249;
            </button>
            <h3>{formatMonthYear(displayDate)}</h3>
            <button onClick={goToNextMonth} className="nav-button">
              &#8250;
            </button>
          </div>

          <div className="calendar-weekdays">
            {weekdays.map(day => (
              <div key={day} className="weekday">
                {day}
              </div>
            ))}
          </div>

          <div className="calendar-grid">
            {days.map((date, index) => {
              if (!date) {
                return <div key={index} className="calendar-day empty"></div>;
              }

              const hasSlots = hasAvailability(date);
              const isPast = isPastDate(date);
              const isClickable = hasSlots && !isPast;

              return (
                <div
                  key={index}
                  className={`calendar-day ${hasSlots ? 'available' : 'unavailable'} ${isPast ? 'past' : ''} ${isClickable ? 'clickable' : ''}`}
                  onClick={() => handleDateClick(date)}
                  title={hasSlots ? `Available` : 'No slots available'}
                >
                  <div className="day-content">
                    <span className="day-number">{date.getDate()}</span>
                    <div className="day-icon">
                      {isPast ? '⏰' : hasSlots ? '✨' : '🚫'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="calendar-legend">
            <div className="legend-item">
              <div className="legend-color available"></div>
              <span>✨ Available</span>
            </div>
            <div className="legend-item">
              <div className="legend-color unavailable"></div>
              <span>🚫 Unavailable</span>
            </div>
            <div className="legend-item">
              <div className="legend-color past"></div>
              <span>⏰ Past</span>
            </div>
          </div>
        </div>
      </div>
      
      <PaymentBookingModal
        isOpen={isBookingModalOpen}
        onClose={handleCloseModal}
        selectedDate={selectedDate}
        onBookingChange={handleBookingChange}
      />
    </section>
  );
}