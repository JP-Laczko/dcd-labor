// Time Slot Utilities
// Handles time slot generation and August 25+ scheduling rules

/**
 * Generates default time slots for a given date
 * @param {Date} date - The date to generate slots for
 * @returns {Array} Array of time slot objects
 */
export const generateDefaultTimeSlots = (date) => {
  const august25 = new Date('2024-08-25');
  const isAfterAugust25 = date >= august25;
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
  
  let slots = [];
  
  // Default time slots: 9AM, 1PM, 3PM for all days
  slots = [
    {
      time: "09:00",
      displayTime: "9AM",
      isAvailable: true,
      bookingId: null
    },
    {
      time: "13:00",
      displayTime: "1PM", 
      isAvailable: true,
      bookingId: null
    },
    {
      time: "15:00",
      displayTime: "3PM",
      isAvailable: true,
      bookingId: null
    }
  ];
  
  return slots;
};

/**
 * Converts 24hr time format to display format
 * @param {string} time24 - Time in 24hr format (e.g., "09:00", "15:00")
 * @returns {string} Display format (e.g., "9AM", "3PM")
 */
export const formatTimeForDisplay = (time24) => {
  const [hours, minutes] = time24.split(':');
  const hour = parseInt(hours);
  
  if (hour === 0) return "12AM";
  if (hour < 12) return `${hour}AM`;
  if (hour === 12) return "12PM";
  return `${hour - 12}PM`;
};

/**
 * Converts display time to 24hr format
 * @param {string} displayTime - Display format (e.g., "9AM", "3PM")
 * @returns {string} 24hr format (e.g., "09:00", "15:00")
 */
export const formatTimeFor24Hr = (displayTime) => {
  const timeMap = {
    "9AM": "09:00",
    "1PM": "13:00", 
    "3PM": "15:00",
    "12AM": "00:00",
    "12PM": "12:00"
  };
  
  return timeMap[displayTime] || displayTime;
};

/**
 * Sorts time slots by earliest time first
 * @param {Array} timeSlots - Array of time slot objects
 * @returns {Array} Array of time slot objects sorted by time
 */
export const sortTimeSlots = (timeSlots) => {
  if (!timeSlots) return [];
  return [...timeSlots].sort((a, b) => a.time.localeCompare(b.time));
};

/**
 * Checks if any time slots are available for a date
 * @param {Array} timeSlots - Array of time slot objects
 * @returns {boolean} True if any slots are available
 */
export const hasAvailableSlots = (timeSlots) => {
  return timeSlots && timeSlots.some(slot => slot.isAvailable);
};

/**
 * Gets available time slots for a date, sorted by time
 * @param {Array} timeSlots - Array of time slot objects  
 * @returns {Array} Array of available time slot objects sorted by time
 */
export const getAvailableSlots = (timeSlots) => {
  if (!timeSlots) return [];
  return timeSlots
    .filter(slot => slot.isAvailable)
    .sort((a, b) => a.time.localeCompare(b.time)); // Sort by 24hr time format
};

/**
 * Validates if a time slot exists and is available
 * @param {Array} timeSlots - Array of time slot objects
 * @param {string} timeSlot - Time slot to validate (24hr format)
 * @returns {boolean} True if slot exists and is available
 */
export const isSlotAvailable = (timeSlots, timeSlot) => {
  const slot = timeSlots?.find(s => s.time === timeSlot);
  return slot && slot.isAvailable;
};

/**
 * Books a time slot by setting it to unavailable and assigning booking ID
 * @param {Array} timeSlots - Array of time slot objects
 * @param {string} timeSlot - Time slot to book (24hr format)
 * @param {string} bookingId - ID of the booking
 * @returns {Array} Updated time slots array
 */
export const bookTimeSlot = (timeSlots, timeSlot, bookingId) => {
  return timeSlots.map(slot => {
    if (slot.time === timeSlot) {
      return {
        ...slot,
        isAvailable: false,
        bookingId: bookingId
      };
    }
    return slot;
  });
};

/**
 * Releases a time slot by setting it to available and clearing booking ID
 * @param {Array} timeSlots - Array of time slot objects
 * @param {string} timeSlot - Time slot to release (24hr format)
 * @returns {Array} Updated time slots array
 */
export const releaseTimeSlot = (timeSlots, timeSlot) => {
  return timeSlots.map(slot => {
    if (slot.time === timeSlot) {
      return {
        ...slot,
        isAvailable: true,
        bookingId: null
      };
    }
    return slot;
  });
};

export default {
  generateDefaultTimeSlots,
  formatTimeForDisplay,
  formatTimeFor24Hr,
  sortTimeSlots,
  hasAvailableSlots,
  getAvailableSlots,
  isSlotAvailable,
  bookTimeSlot,
  releaseTimeSlot
};