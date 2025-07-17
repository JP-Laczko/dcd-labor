import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/CalendarSection.css";
import mongoService from "../services/mongoService";

export default function CalendarSection() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dailyAvailability, setDailyAvailability] = useState(new Map());
  const navigate = useNavigate();

  useEffect(() => {
    // Initialize MongoDB connection and fetch availability
    mongoService.connect();
    fetchAvailability();
  }, [currentDate]);

  const fetchAvailability = async () => {
    try {
      const availability = new Map();
      const today = new Date();
      
      // Generate availability for next 2 weeks
      for (let i = 1; i <= 14; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        
        // Skip Sundays (business closed)
        if (date.getDay() !== 0) {
          // Fetch availability from MongoDB
          const result = await mongoService.getCalendarAvailability(date);
          
          if (result.success && result.availability) {
            const dayAvailability = result.availability;
            const availableSlots = dayAvailability.availability.maxBookings - dayAvailability.availability.currentBookings;
            availability.set(date.toDateString(), Math.max(0, availableSlots));
          } else {
            // Default to 1 available slot if no data
            availability.set(date.toDateString(), 1);
          }
        }
      }
      
      setDailyAvailability(availability);
    } catch (error) {
      console.error('Error fetching calendar availability:', error);
      
      // Fallback to mock data
      const mockDailyAvailability = new Map();
      const today = new Date();
      
      for (let i = 1; i <= 14; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        
        if (date.getDay() !== 0) {
          const availableCount = Math.random() > 0.3 ? 1 : 0;
          mockDailyAvailability.set(date.toDateString(), availableCount);
        }
      }
      
      setDailyAvailability(mockDailyAvailability);
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

  const handleDateClick = (date) => {
    if (!date || !hasAvailability(date) || isPastDate(date)) return;
    
    const dateString = date.toISOString().split('T')[0];
    // Navigate to schedule page with pre-filled date
    navigate(`/schedule?date=${dateString}`);
  };

  const hasAvailability = (date) => {
    return dailyAvailability.has(date.toDateString()) && dailyAvailability.get(date.toDateString()) > 0;
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
        <p>Click on an available date to book your service</p>
        
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

              return (
                <div
                  key={index}
                  className={`calendar-day ${hasSlots ? 'available' : 'unavailable'} ${isPast ? 'past' : ''} ${isClickable ? 'clickable' : ''}`}
                  onClick={() => handleDateClick(date)}
                  title={hasSlots ? `Available` : 'No slots available'}
                >
                  <span className="day-number">{date.getDate()}</span>
                </div>
              );
            })}
          </div>

          <div className="calendar-legend">
            <div className="legend-item">
              <div className="legend-color available"></div>
              <span>Available</span>
            </div>
            <div className="legend-item">
              <div className="legend-color unavailable"></div>
              <span>Unavailable</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}