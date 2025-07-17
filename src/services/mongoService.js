// MongoDB Service for DCD Labor
// This service handles all database operations

const MONGODB_URI = import.meta.env.VITE_MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = import.meta.env.VITE_MONGODB_DB_NAME || 'dcd_labor';

class MongoService {
  constructor() {
    this.isConnected = false;
    this.db = null;
    this.collections = {
      bookings: 'bookings',
      calendar: 'calendar_availability',
      rates: 'team_rates',
      admins: 'admin_users'
    };
  }

  // Initialize connection (placeholder - would use MongoDB driver in production)
  async connect() {
    try {
      // In a real app, this would connect to MongoDB
      // For now, we'll simulate connection and use localStorage as fallback
      
      if (MONGODB_URI === 'mongodb://localhost:27017') {
        console.log('MongoDB not configured, using localStorage fallback');
        this.isConnected = false;
        return false;
      }
      
      // Placeholder for actual MongoDB connection
      console.log('Connecting to MongoDB:', MONGODB_URI);
      this.isConnected = true;
      return true;
    } catch (error) {
      console.error('MongoDB connection error:', error);
      this.isConnected = false;
      return false;
    }
  }

  // Generate unique ID
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // BOOKING OPERATIONS
  async createBooking(bookingData) {
    try {
      const booking = {
        bookingId: this.generateId(),
        customer: {
          name: bookingData.name,
          email: bookingData.email,
          phone: bookingData.phone,
          address: bookingData.address
        },
        service: {
          date: new Date(bookingData.date),
          crewSize: parseInt(bookingData.crewSize),
          yardAcreage: bookingData.yardAcreage,
          services: bookingData.services,
          notes: bookingData.notes || '',
          estimatedHours: null,
          totalCost: null
        },
        status: {
          current: 'pending',
          history: [{
            status: 'pending',
            timestamp: new Date(),
            notes: 'Initial booking submitted'
          }]
        },
        payment: {
          depositAmount: null,
          depositPaid: false,
          depositDate: null,
          finalAmount: null,
          finalPaid: false,
          finalDate: null,
          paymentMethod: null
        },
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'customer',
          assignedCrew: [],
          internalNotes: '',
          emailsSent: {
            customerConfirmation: false,
            dcdNotification: false,
            confirmationSent: false,
            reminderSent: false
          }
        }
      };

      if (this.isConnected) {
        // Real MongoDB operation would go here
        console.log('Saving booking to MongoDB:', booking);
        return { success: true, booking };
      } else {
        // Fallback to localStorage
        const bookings = this.getLocalBookings();
        bookings.push(booking);
        localStorage.setItem('dcd_bookings', JSON.stringify(bookings));
        
        // Update calendar availability
        await this.updateCalendarAvailability(booking.service.date, 1);
        
        return { success: true, booking };
      }
    } catch (error) {
      console.error('Error creating booking:', error);
      return { success: false, error: error.message };
    }
  }

  async getBookings(filters = {}) {
    try {
      if (this.isConnected) {
        // Real MongoDB query would go here
        console.log('Fetching bookings from MongoDB with filters:', filters);
        return { success: true, bookings: [] };
      } else {
        // Fallback to localStorage
        let bookings = this.getLocalBookings();
        
        // Apply filters
        if (filters.date) {
          const filterDate = new Date(filters.date).toDateString();
          bookings = bookings.filter(b => new Date(b.service.date).toDateString() === filterDate);
        }
        
        if (filters.status) {
          bookings = bookings.filter(b => b.status.current === filters.status);
        }
        
        if (filters.email) {
          bookings = bookings.filter(b => b.customer.email === filters.email);
        }
        
        return { success: true, bookings };
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
      return { success: false, error: error.message };
    }
  }

  async updateBookingStatus(bookingId, newStatus, notes = '') {
    try {
      if (this.isConnected) {
        // Real MongoDB operation would go here
        console.log('Updating booking status in MongoDB:', bookingId, newStatus);
        return { success: true };
      } else {
        // Fallback to localStorage
        const bookings = this.getLocalBookings();
        const bookingIndex = bookings.findIndex(b => b.bookingId === bookingId);
        
        if (bookingIndex === -1) {
          return { success: false, error: 'Booking not found' };
        }
        
        bookings[bookingIndex].status.current = newStatus;
        bookings[bookingIndex].status.history.push({
          status: newStatus,
          timestamp: new Date(),
          notes: notes
        });
        bookings[bookingIndex].metadata.updatedAt = new Date();
        
        localStorage.setItem('dcd_bookings', JSON.stringify(bookings));
        return { success: true };
      }
    } catch (error) {
      console.error('Error updating booking status:', error);
      return { success: false, error: error.message };
    }
  }

  // CALENDAR OPERATIONS
  async getCalendarAvailability(date) {
    try {
      const dateString = new Date(date).toISOString().split('T')[0];
      
      if (this.isConnected) {
        // Real MongoDB query would go here
        console.log('Fetching calendar availability from MongoDB:', dateString);
        return { success: true, availability: null };
      } else {
        // Fallback to localStorage
        const calendar = this.getLocalCalendar();
        const dayAvailability = calendar[dateString];
        
        return { 
          success: true, 
          availability: dayAvailability || {
            date: new Date(date),
            dateString: dateString,
            availability: {
              maxBookings: 1,
              currentBookings: 0,
              isAvailable: true,
              crewAvailability: {
                twoMan: 1,
                threeMan: 1,
                fourMan: 1
              }
            },
            businessRules: {
              isDayOff: new Date(date).getDay() === 0, // Sunday
              isBlocked: false,
              blockReason: null,
              weather: null,
              specialNotes: null
            },
            bookings: [],
            metadata: {
              createdAt: new Date(),
              updatedAt: new Date(),
              lastModifiedBy: 'system'
            }
          }
        };
      }
    } catch (error) {
      console.error('Error fetching calendar availability:', error);
      return { success: false, error: error.message };
    }
  }

  async updateCalendarAvailability(date, bookingChange = 0) {
    try {
      const dateString = new Date(date).toISOString().split('T')[0];
      
      if (this.isConnected) {
        // Real MongoDB operation would go here
        console.log('Updating calendar availability in MongoDB:', dateString, bookingChange);
        return { success: true };
      } else {
        // Fallback to localStorage
        const calendar = this.getLocalCalendar();
        
        if (!calendar[dateString]) {
          calendar[dateString] = {
            date: new Date(date),
            dateString: dateString,
            availability: {
              maxBookings: 1,
              currentBookings: 0,
              isAvailable: true,
              crewAvailability: { twoMan: 1, threeMan: 1, fourMan: 1 }
            },
            businessRules: {
              isDayOff: new Date(date).getDay() === 0,
              isBlocked: false,
              blockReason: null,
              weather: null,
              specialNotes: null
            },
            bookings: [],
            metadata: {
              createdAt: new Date(),
              updatedAt: new Date(),
              lastModifiedBy: 'system'
            }
          };
        }
        
        calendar[dateString].availability.currentBookings += bookingChange;
        calendar[dateString].availability.isAvailable = 
          calendar[dateString].availability.currentBookings < calendar[dateString].availability.maxBookings;
        calendar[dateString].metadata.updatedAt = new Date();
        
        localStorage.setItem('dcd_calendar', JSON.stringify(calendar));
        return { success: true };
      }
    } catch (error) {
      console.error('Error updating calendar availability:', error);
      return { success: false, error: error.message };
    }
  }

  async setDailyBookingLimit(date, maxBookings) {
    try {
      const dateString = new Date(date).toISOString().split('T')[0];
      
      if (this.isConnected) {
        // Real MongoDB operation would go here
        console.log('Setting daily booking limit in MongoDB:', dateString, maxBookings);
        return { success: true };
      } else {
        // Fallback to localStorage
        const calendar = this.getLocalCalendar();
        
        if (!calendar[dateString]) {
          await this.updateCalendarAvailability(date, 0); // Initialize day
        }
        
        calendar[dateString].availability.maxBookings = maxBookings;
        calendar[dateString].availability.isAvailable = 
          calendar[dateString].availability.currentBookings < maxBookings;
        calendar[dateString].metadata.updatedAt = new Date();
        calendar[dateString].metadata.lastModifiedBy = 'admin';
        
        localStorage.setItem('dcd_calendar', JSON.stringify(calendar));
        return { success: true };
      }
    } catch (error) {
      console.error('Error setting daily booking limit:', error);
      return { success: false, error: error.message };
    }
  }

  // RATES OPERATIONS
  async getRates() {
    try {
      if (this.isConnected) {
        // Real MongoDB query would go here
        console.log('Fetching rates from MongoDB');
        return { success: true, rates: null };
      } else {
        // Fallback to localStorage (existing rateService)
        const rates = JSON.parse(localStorage.getItem('teamRates') || '{}');
        return { success: true, rates };
      }
    } catch (error) {
      console.error('Error fetching rates:', error);
      return { success: false, error: error.message };
    }
  }

  async updateRates(newRates) {
    try {
      if (this.isConnected) {
        // Real MongoDB operation would go here
        console.log('Updating rates in MongoDB:', newRates);
        return { success: true };
      } else {
        // Fallback to localStorage (existing rateService)
        localStorage.setItem('teamRates', JSON.stringify(newRates));
        return { success: true };
      }
    } catch (error) {
      console.error('Error updating rates:', error);
      return { success: false, error: error.message };
    }
  }

  // UTILITY METHODS
  getLocalBookings() {
    return JSON.parse(localStorage.getItem('dcd_bookings') || '[]');
  }

  getLocalCalendar() {
    return JSON.parse(localStorage.getItem('dcd_calendar') || '{}');
  }

  // Initialize sample data for testing
  async initializeSampleData() {
    try {
      // Add sample calendar data for next 30 days
      const today = new Date();
      for (let i = 1; i <= 30; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        
        // Skip Sundays
        if (date.getDay() !== 0) {
          const availability = await this.getCalendarAvailability(date);
          if (availability.success && !availability.availability.availability) {
            await this.updateCalendarAvailability(date, 0);
          }
        }
      }
      
      console.log('Sample data initialized');
      return { success: true };
    } catch (error) {
      console.error('Error initializing sample data:', error);
      return { success: false, error: error.message };
    }
  }
}

export const mongoService = new MongoService();
export default mongoService;