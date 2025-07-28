import { useState, useEffect } from "react";
import "../styles/CalendarSection.css";
import mongoService from "../services/mongoService";
import PaymentBookingModal from "./PaymentBookingModal";
import timeSlotUtils from "../utils/timeSlotUtils";

export default function CalendarSectionTimeSlots() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dailyTimeSlots, setDailyTimeSlots] = useState(new Map());
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
  const [showTimeSlotSelector, setShowTimeSlotSelector] = useState(false);

  useEffect(() => {
    const initializeCalendar = async () => {
      console.log('📅 CalendarSection: Initializing time slots calendar...');
      try {
        const connectionResult = await mongoService.connect();
        console.log('📅 CalendarSection: MongoDB connection result:', connectionResult);
        await fetchTimeSlots();
      } catch (error) {
        console.error('📅 CalendarSection: Initialization error:', error);
        await fetchTimeSlots();
      }
    };
    
    initializeCalendar();
  }, [currentDate]);

  const fetchTimeSlots = async () => {
    try {
      const timeSlots = new Map();
      const today = new Date();
      
      // Initialize next 2 weeks with default time slots
      for (let i = 1; i <= 14; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const dateString = date.toISOString().split('T')[0];
        
        // Generate default time slots for each date
        const defaultSlots = timeSlotUtils.generateDefaultTimeSlots(date);
        timeSlots.set(dateString, defaultSlots);
      }
      
      // Get calendar availability from database and merge with defaults
      const calendarResult = await mongoService.getAllCalendarAvailability();
      
      if (calendarResult.success && calendarResult.availability) {
        calendarResult.availability.forEach(entry => {
          if (entry.availability && entry.availability.timeSlots) {
            // Use database time slots if available
            timeSlots.set(entry.date, entry.availability.timeSlots);
          }
        });
      }
      
      // Get existing bookings to mark slots as unavailable
      const bookingsResult = await mongoService.getBookings();
      
      if (bookingsResult.success && bookingsResult.bookings) {
        bookingsResult.bookings.forEach(booking => {
          const bookingDate = new Date(booking.service?.date || booking.date);
          const dateString = bookingDate.toISOString().split('T')[0];
          const bookingTimeSlot = booking.service?.timeSlot;
          
          if (timeSlots.has(dateString) && bookingTimeSlot) {
            const daySlots = timeSlots.get(dateString);
            const updatedSlots = daySlots.map(slot => {
              if (slot.time === bookingTimeSlot) {
                return {
                  ...slot,
                  isAvailable: false,
                  bookingId: booking.bookingId || booking._id
                };
              }
              return slot;
            });
            timeSlots.set(dateString, updatedSlots);
          }
        });
      }
      
      setDailyTimeSlots(timeSlots);
    } catch (error) {
      console.error('❌ Calendar: Error fetching time slots:', error);
      
      // Fallback: generate default time slots for all days
      const fallbackTimeSlots = new Map();
      const today = new Date();
      
      for (let i = 1; i <= 14; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const dateString = date.toISOString().split('T')[0];
        const defaultSlots = timeSlotUtils.generateDefaultTimeSlots(date);
        fallbackTimeSlots.set(dateString, defaultSlots);
      }
      
      setDailyTimeSlots(fallbackTimeSlots);
    }
  };

  const handleDateClick = (date) => {
    if (!date || !hasAvailability(date) || isPastDate(date)) return;
    
    // Always show time slot selector for confirmation (even for single slots)
    setSelectedDate(date);
    setShowTimeSlotSelector(true);
  };

  const handleTimeSlotSelection = (timeSlot) => {
    setSelectedTimeSlot(timeSlot);
    setShowTimeSlotSelector(false);
    setIsBookingModalOpen(true);
  };

  const handleBookingChange = () => {
    // Refresh time slots when a booking is made
    fetchTimeSlots();
  };

  const handleCloseModal = () => {
    setIsBookingModalOpen(false);
    setShowTimeSlotSelector(false);
    setSelectedDate(null);
    setSelectedTimeSlot(null);
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
    const timeSlots = dailyTimeSlots.get(dateString) || [];
    return timeSlotUtils.hasAvailableSlots(timeSlots);
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
    <section className="calendar-section">
      <div className="calendar-container">
        <h2>Schedule Your Service</h2>
        <p>Click on an available date to choose your time slot</p>
        
        <div className="calendar">
          <div className="calendar-header">
            <button onClick={goToPreviousMonth} className="nav-button">
              &#8249;
            </button>
            <h3>{formatMonthYear(currentDate)}</h3>
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
              
              const dateString = date.toISOString().split('T')[0];
              const timeSlots = dailyTimeSlots.get(dateString) || [];
              const availableSlots = timeSlotUtils.getAvailableSlots(timeSlots);

              return (
                <div
                  key={index}
                  className={`calendar-day ${hasSlots ? 'available' : 'unavailable'} ${isPast ? 'past' : ''} ${isClickable ? 'clickable' : ''}`}
                  onClick={() => handleDateClick(date)}
                  title={hasSlots ? `${availableSlots.length} slot${availableSlots.length !== 1 ? 's' : ''} available` : 'No slots available'}
                >
                  <div className="day-content">
                    <span className="day-number">{date.getDate()}</span>
                    
                    {/* Show available time slots */}
                    {!isPast && (
                      <div className="time-slots-preview">
                        {timeSlotUtils.sortTimeSlots(availableSlots).map((slot, idx) => (
                          <div key={idx} className="time-slot-preview">
                            {slot.displayTime}
                          </div>
                        ))}
                      </div>
                    )}
                    
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Calendar Legend */}
        <div className="calendar-legend">
          <div className="legend-item">
            <div className="legend-color available"></div>
            <span>Available slots</span>
          </div>
          <div className="legend-item">
            <div className="legend-color unavailable"></div>
            <span>No slots available</span>
          </div>
          <div className="legend-item">
            <div className="legend-color past"></div>
            <span>Past dates</span>
          </div>
        </div>
      </div>

      {/* Time Slot Selector Modal */}
      {showTimeSlotSelector && selectedDate && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content time-slot-selector" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Select a Time Slot for {selectedDate.toLocaleDateString()}</h3>
              <button className="close-button" onClick={handleCloseModal}>&times;</button>
            </div>
            
            <div className="modal-body">
              <div className="time-slot-options">
                {(() => {
                  const dateString = selectedDate.toISOString().split('T')[0];
                  const timeSlots = dailyTimeSlots.get(dateString) || [];
                  const availableSlots = timeSlotUtils.getAvailableSlots(timeSlots);
                  
                  return timeSlotUtils.sortTimeSlots(availableSlots).map((slot, idx) => (
                    <button
                      key={idx}
                      className="time-slot-option"
                      onClick={() => handleTimeSlotSelection(slot.time)}
                    >
                      <div className="time-display">{slot.displayTime}</div>
                      <div className="time-24hr">{slot.time}</div>
                    </button>
                  ));
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      <PaymentBookingModal
        isOpen={isBookingModalOpen}
        onClose={handleCloseModal}
        selectedDate={selectedDate}
        selectedTimeSlot={selectedTimeSlot}
        onBookingChange={handleBookingChange}
      />
    </section>
  );
}