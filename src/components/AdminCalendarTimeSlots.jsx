import { useState, useEffect } from "react";
import "../styles/Admin.css";
import mongoService from "../services/mongoService";
import BookingModal from "./BookingModal";
import SquareFinalPayment from "./SquareFinalPayment";
import timeSlotUtils from "../utils/timeSlotUtils";

export default function AdminCalendarTimeSlots() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dailyTimeSlots, setDailyTimeSlots] = useState(new Map()); // Map of date -> timeSlots array
  const [dailyBookings, setDailyBookings] = useState(new Map());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showTimeSlotsModal, setShowTimeSlotsModal] = useState(false);
  const [selectedTimeSlotsDate, setSelectedTimeSlotsDate] = useState(null);
  const [editingTimeSlots, setEditingTimeSlots] = useState([]);
  const [expandedBooking, setExpandedBooking] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [showFinalPaymentModal, setShowFinalPaymentModal] = useState(false);
  const [selectedBookingForPayment, setSelectedBookingForPayment] = useState(null);
  const [rates, setRates] = useState({});

  useEffect(() => {
    const initializeCalendar = async () => {
      console.log('📅 AdminCalendar: Initializing time slots calendar...');
      try {
        const connectionResult = await mongoService.connect();
        console.log('📅 AdminCalendar: MongoDB connection result:', connectionResult);
        await fetchTimeSlots();
        await fetchBookings();
        await loadRates();
      } catch (error) {
        console.error('📅 AdminCalendar: Initialization error:', error);
        await fetchTimeSlots();
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
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchTimeSlots = async () => {
    try {
      const timeSlots = new Map();
      const today = new Date();
      
      // Initialize next 2 weeks with default time slots (including today for admin view)
      for (let i = 0; i <= 14; i++) {
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
      
      setDailyTimeSlots(timeSlots);
    } catch (error) {
      console.error('❌ Calendar: Error fetching time slots:', error);
      
      // Fallback: generate default time slots for all days
      const fallbackTimeSlots = new Map();
      const today = new Date();
      
      for (let i = 0; i <= 14; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const dateString = date.toISOString().split('T')[0];
        const defaultSlots = timeSlotUtils.generateDefaultTimeSlots(date);
        fallbackTimeSlots.set(dateString, defaultSlots);
      }
      
      setDailyTimeSlots(fallbackTimeSlots);
    }
  };

  const fetchBookings = async () => {
    try {
      const bookingsResult = await mongoService.getBookings();
      
      if (bookingsResult.success && bookingsResult.bookings) {
        const bookingsByDate = new Map();
        
        bookingsResult.bookings.forEach(booking => {
          const bookingDate = new Date(booking.service?.date || booking.date);
          const dateString = bookingDate.toISOString().split('T')[0];
          
          if (!bookingsByDate.has(dateString)) {
            bookingsByDate.set(dateString, []);
          }
          bookingsByDate.get(dateString).push(booking);
        });
        
        setDailyBookings(bookingsByDate);
        
        // Update time slots to mark booked slots as unavailable
        updateTimeSlotsWithBookings(bookingsByDate);
      }
    } catch (error) {
      console.error('❌ Calendar: Error fetching bookings:', error);
      setDailyBookings(new Map());
    }
  };

  const updateTimeSlotsWithBookings = (bookingsByDate) => {
    setDailyTimeSlots(prevTimeSlots => {
      const newTimeSlots = new Map(prevTimeSlots);
      
      // First, reset all slots to available (remove booking status)
      newTimeSlots.forEach((daySlots, dateString) => {
        const resetSlots = daySlots.map(slot => ({
          ...slot,
          isAvailable: true,
          bookingId: null
        }));
        newTimeSlots.set(dateString, resetSlots);
      });
      
      // Then, mark slots as booked based on current bookings
      bookingsByDate.forEach((bookings, dateString) => {
        const daySlots = newTimeSlots.get(dateString);
        if (daySlots) {
          const updatedSlots = daySlots.map(slot => {
            // Check if this slot is booked
            const booking = bookings.find(b => b.service?.timeSlot === slot.time);
            if (booking) {
              return {
                ...slot,
                isAvailable: false,
                bookingId: booking.bookingId || booking._id
              };
            }
            return slot;
          });
          newTimeSlots.set(dateString, updatedSlots);
        }
      });
      
      return newTimeSlots;
    });
  };

  const handleTimeSlotsEdit = (dateString) => {
    const currentSlots = dailyTimeSlots.get(dateString) || [];
    setSelectedTimeSlotsDate(dateString);
    setEditingTimeSlots(timeSlotUtils.sortTimeSlots(currentSlots)); // Create a copy for editing, sorted
    setShowTimeSlotsModal(true);
  };

  const closeTimeSlotsModal = () => {
    setShowTimeSlotsModal(false);
    setSelectedTimeSlotsDate(null);
    setEditingTimeSlots([]);
  };

  const addTimeSlot = () => {
    const newSlot = {
      time: "09:00",
      displayTime: "9AM",
      isAvailable: true,
      bookingId: null
    };
    setEditingTimeSlots([...editingTimeSlots, newSlot]);
  };

  const removeTimeSlot = (index) => {
    const slot = editingTimeSlots[index];
    if (slot.bookingId) {
      const confirmRemoval = window.confirm(
        "This time slot has a booking. Removing it will force the time slot to be available again. This should fix the booking glitch where removed bookings still show as booked. Continue?"
      );
      if (!confirmRemoval) {
        return;
      }
    }
    setEditingTimeSlots(editingTimeSlots.filter((_, i) => i !== index));
  };

  const updateTimeSlot = (index, field, value) => {
    const updatedSlots = editingTimeSlots.map((slot, i) => {
      if (i === index) {
        const updatedSlot = { ...slot, [field]: value };
        
        // Auto-update displayTime when time changes
        if (field === 'time') {
          updatedSlot.displayTime = timeSlotUtils.formatTimeForDisplay(value);
        }
        
        return updatedSlot;
      }
      return slot;
    });
    setEditingTimeSlots(updatedSlots);
  };

  const saveTimeSlots = async () => {
    try {
      console.log('🔧 Saving time slots:', { selectedTimeSlotsDate, editingTimeSlots });
      
      const result = await mongoService.updateCalendarTimeSlots(selectedTimeSlotsDate, editingTimeSlots);
      console.log('🔧 Update result:', result);
      
      if (result.success) {
        // Update local state
        setDailyTimeSlots(prev => new Map(prev.set(selectedTimeSlotsDate, editingTimeSlots)));
        closeTimeSlotsModal();
        alert('Time slots updated successfully!');
      } else {
        console.error('🔧 Update failed:', result.error);
        alert('Error updating time slots: ' + result.error);
      }
    } catch (error) {
      console.error('Error saving time slots:', error);
      alert('Error saving time slots. Please try again.');
    }
  };

  // Quick Add individual time slot functionality
  const quickAdd9AM = () => {
    const slot9AM = {
      time: "09:00",
      displayTime: "9AM",
      isAvailable: true,
      bookingId: null
    };
    
    // Check if 9AM slot already exists
    const existingSlotIndex = editingTimeSlots.findIndex(slot => slot.time === "09:00");
    if (existingSlotIndex === -1) {
      // Add new slot and sort by time
      const newSlots = [...editingTimeSlots, slot9AM];
      setEditingTimeSlots(timeSlotUtils.sortTimeSlots(newSlots));
    }
  };

  const quickAdd1PM = () => {
    const slot1PM = {
      time: "13:00",
      displayTime: "1PM",
      isAvailable: true,
      bookingId: null
    };
    
    // Check if 1PM slot already exists
    const existingSlotIndex = editingTimeSlots.findIndex(slot => slot.time === "13:00");
    if (existingSlotIndex === -1) {
      // Add new slot and sort by time
      const newSlots = [...editingTimeSlots, slot1PM];
      setEditingTimeSlots(timeSlotUtils.sortTimeSlots(newSlots));
    }
  };

  const quickAdd3PM = () => {
    const slot3PM = {
      time: "15:00",
      displayTime: "3PM",
      isAvailable: true,
      bookingId: null
    };
    
    // Check if 3PM slot already exists
    const existingSlotIndex = editingTimeSlots.findIndex(slot => slot.time === "15:00");
    if (existingSlotIndex === -1) {
      // Add new slot and sort by time
      const newSlots = [...editingTimeSlots, slot3PM];
      setEditingTimeSlots(timeSlotUtils.sortTimeSlots(newSlots));
    }
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];

    const startingDayOfWeek = firstDay.getDay();
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const formatMonthYear = (date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const goToPreviousMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleDateClick = (date) => {
    setSelectedDate(date);
    setSelectedBooking(null);
    setIsModalOpen(true);
  };

  const handleBookingClick = (e, booking) => {
    e.stopPropagation();
    
    if (isMobile) {
      const bookingKey = `${booking.bookingId}_${booking.service?.date || booking.date}`;
      if (expandedBooking === bookingKey) {
        // Second tap on mobile - open modal
        setSelectedBooking(booking);
        setSelectedDate(new Date(booking.service?.date || booking.date));
        setIsModalOpen(true);
      } else {
        // First tap on mobile - expand
        setExpandedBooking(bookingKey);
      }
    } else {
      // Desktop - open modal immediately
      setSelectedBooking(booking);
      setSelectedDate(new Date(booking.service?.date || booking.date));
      setIsModalOpen(true);
    }
  };

  const handleBookingChange = async () => {
    await fetchTimeSlots();
    await fetchBookings();
  };

  const days = getDaysInMonth(currentDate);

  return (
    <>
      <div className="admin-calendar">
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
          {days.map((date, index) => {
            if (!date) {
              return <div key={index} className="calendar-day inactive"></div>;
            }

            const dateString = date.toISOString().split('T')[0];
            const timeSlots = dailyTimeSlots.get(dateString) || [];
            const availableSlots = timeSlotUtils.getAvailableSlots(timeSlots);
            const dayBookings = dailyBookings.get(dateString) || [];

            return (
              <div key={index} className="calendar-day active" onClick={() => handleDateClick(date)}>
                <div className="day-number">{date.getDate()}</div>
                
                <div className="day-content">
                  {/* Time Slots Display */}
                  <div className="time-slots-display">
                    {timeSlotUtils.sortTimeSlots(timeSlots).map((slot, idx) => (
                      <div 
                        key={idx}
                        className={`time-slot-chip ${slot.isAvailable ? 'available' : 'booked'}`}
                      >
                        {slot.displayTime}
                      </div>
                    ))}
                  </div>
                  
                  <div className="bookings-list">
                    {dayBookings.length > 0 ? (
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
                              {booking.service?.timeSlot && (
                                <span className="booking-time">
                                  @ {booking.service.displayTime || timeSlotUtils.formatTimeForDisplay(booking.service.timeSlot)}
                                </span>
                              )}
                            </div>
                            <div className="booking-details">
                              <span className="crew-size">{booking.service?.crewSize || 'N/A'}-person crew</span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="no-bookings">No bookings</div>
                    )}
                  </div>
                  
                  <button 
                    className="adjust-bookings"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTimeSlotsEdit(dateString);
                    }}
                  >
                    Edit Time Slots
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <BookingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedDate={selectedDate}
        onBookingChange={handleBookingChange}
        booking={selectedBooking}
        rates={rates}
        onFinalPayment={(booking) => {
          setSelectedBookingForPayment(booking);
          setShowFinalPaymentModal(true);
          setIsModalOpen(false);
        }}
      />

      {/* Edit Time Slots Modal */}
      {showTimeSlotsModal && selectedTimeSlotsDate && (
        <div className="modal-overlay" onClick={closeTimeSlotsModal}>
          <div className="modal-content time-slots-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Time Slots for {new Date(selectedTimeSlotsDate).toLocaleDateString()}</h3>
              <button className="close-button" onClick={closeTimeSlotsModal}>&times;</button>
            </div>
            
            <div className="modal-body">
              <div className="time-slots-editor">
                {editingTimeSlots.map((slot, index) => (
                  <div key={index} className="time-slot-row">
                    <input
                      type="time"
                      value={slot.time}
                      onChange={(e) => updateTimeSlot(index, 'time', e.target.value)}
                      disabled={!!slot.bookingId}
                    />
                    <input
                      type="text"
                      value={slot.displayTime}
                      onChange={(e) => updateTimeSlot(index, 'displayTime', e.target.value)}
                      placeholder="Display (e.g., 9AM)"
                      disabled={!!slot.bookingId}
                    />
                    <label>
                      <input
                        type="checkbox"
                        checked={slot.isAvailable}
                        onChange={(e) => updateTimeSlot(index, 'isAvailable', e.target.checked)}
                        disabled={!!slot.bookingId}
                      />
                      Available
                    </label>
                    <button 
                      onClick={() => removeTimeSlot(index)}
                      disabled={!!slot.bookingId}
                      className="btn-danger"
                    >
                      Remove
                    </button>
                    {slot.bookingId && <span className="booking-indicator">Booked</span>}
                  </div>
                ))}
                
                <div className="time-slot-actions">
                  <button onClick={addTimeSlot} className="btn-secondary">
                    Add Time Slot
                  </button>
                  
                  <div className="quick-fill-buttons">
                    <h4>Quick Add:</h4>
                    <button onClick={quickAdd9AM} className="btn-outline">
                      + 9AM
                    </button>
                    <button onClick={quickAdd1PM} className="btn-outline">
                      + 1PM
                    </button>
                    <button onClick={quickAdd3PM} className="btn-outline">
                      + 3PM
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeTimeSlotsModal}>Cancel</button>
              <button className="btn-primary" onClick={saveTimeSlots}>Save Changes</button>
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
          handleBookingChange();
        }}
      />
    </>
  );
}