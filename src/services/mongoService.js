// MongoDB Service for DCD Labor
// This service handles all database operations

const MONGODB_URI = import.meta.env.VITE_MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = import.meta.env.VITE_MONGODB_DB_NAME || 'dcd_labor';

class MongoService {
  constructor() {
    this.isConnected = false;
    this.db = null;
    this.client = null;
    this.collections = {
      bookings: 'bookings',
      calendar: 'calendar_availability',
      rates: 'team_rates'
    };
  }

  // Initialize connection to MongoDB
  async connect() {
    try {
      if (MONGODB_URI === 'mongodb://localhost:27017') {
        console.log('MongoDB not configured, using localStorage fallback');
        this.isConnected = false;
        return false;
      }
      
      console.log('Connecting to MongoDB backend...');
      
      // For browser-based applications, we need to use a different approach
      // Since MongoDB driver doesn't work in browsers, we'll use fetch to a backend API
      // For now, we'll simulate connection but keep the queries as placeholders
      
      try {
        // Test connection by making a health check request to the backend API
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}/api/health`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          console.log('✅ Successfully connected to backend API');
          this.isConnected = true;
          return true;
        } else {
          throw new Error(`Backend health check failed: ${response.status}`);
        }
      } catch (connectionError) {
        console.error('❌ Failed to connect to MongoDB backend:', connectionError);
        this.isConnected = false;
        return false;
      }
    } catch (error) {
      console.error('MongoDB connection error:', error);
      this.isConnected = false;
      return false;
    }
  }

  // RATE MANAGEMENT
  async getRates() {
    try {
      // Always try to connect first and wait for it
      const connected = await this.connect();
      
      if (!connected) {
        throw new Error('Failed to connect to backend API');
      }
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}/api/team-rates`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const rates = await response.json();
        // Save to localStorage for caching
        localStorage.setItem('teamRates', JSON.stringify(rates));
        return { success: true, rates };
      } else {
        throw new Error(`Failed to fetch rates: ${response.status}`);
      }
    } catch (error) {
      // Fallback to localStorage
      const savedRates = localStorage.getItem('teamRates');
      if (savedRates) {
        const rates = JSON.parse(savedRates);
        // Check for old format and migrate
        if (rates.twoMan && typeof rates.twoMan === 'object' && rates.twoMan.high) {
          const migratedRates = {
            twoMan: rates.twoMan.high || 70,
            threeMan: rates.threeMan.high || 100,
            fourMan: rates.fourMan.high || 130
          };
          localStorage.setItem('teamRates', JSON.stringify(migratedRates));
          return { success: true, rates: migratedRates };
        }
        return { success: true, rates };
      } else {
        const defaultRates = { twoMan: 70, threeMan: 100, fourMan: 130 };
        localStorage.setItem('teamRates', JSON.stringify(defaultRates));
        console.log('💾 Saved default rates to localStorage:', defaultRates);
        return { success: true, rates: defaultRates };
      }
    }
  }

  async updateRates(rates) {
    try {
      if (this.isConnected) {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}/api/team-rates`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(rates)
        });
        
        if (response.ok) {
          console.log('✅ Updated rates in MongoDB');
          // Also save to localStorage as backup
          localStorage.setItem('teamRates', JSON.stringify(rates));
          return { success: true };
        } else {
          throw new Error(`Failed to update rates: ${response.status}`);
        }
      } else {
        // Fallback to localStorage
        localStorage.setItem('teamRates', JSON.stringify(rates));
        console.log('💾 Saved rates to localStorage (fallback)');
        return { success: true };
      }
    } catch (error) {
      console.error('Error updating rates:', error);
      // Fallback to localStorage
      localStorage.setItem('teamRates', JSON.stringify(rates));
      return { success: false, error: error.message };
    }
  }

  // Generate unique ID
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Check if a specific date is available for booking
  async checkDateAvailability(dateString) {
    try {
      // Get calendar availability for the date
      const calendarResult = await this.getAllCalendarAvailability();
      let allowedBookings = 0;
      
      if (calendarResult.success && calendarResult.availability) {
        const dateEntry = calendarResult.availability.find(entry => entry.date === dateString);
        allowedBookings = dateEntry?.bookings || 0;
      }
      
      // Get existing bookings for the date
      const bookingsResult = await this.getBookings();
      let existingBookings = 0;
      
      if (bookingsResult.success && bookingsResult.bookings) {
        existingBookings = bookingsResult.bookings.filter(booking => {
          const bookingDate = new Date(booking.service?.date || booking.date);
          const bookingDateString = bookingDate.toISOString().split('T')[0];
          return bookingDateString === dateString;
        }).length;
      }
      
      const isAvailable = allowedBookings > 0 && existingBookings < allowedBookings;
      
      return {
        isAvailable,
        allowedBookings,
        existingBookings,
        remainingSlots: Math.max(0, allowedBookings - existingBookings)
      };
    } catch (error) {
      console.error('Error checking date availability:', error);
      return {
        isAvailable: false,
        error: error.message
      };
    }
  }

  // BOOKING OPERATIONS
  async createBooking(bookingData) {
    try {
      // First, check if the date is available
      const dateString = new Date(bookingData.date).toISOString().split('T')[0];
      const availabilityCheck = await this.checkDateAvailability(dateString);
      
      if (!availabilityCheck.isAvailable) {
        return {
          success: false,
          error: 'The selected date is not available for booking. Please choose another date.',
          reason: 'date_unavailable'
        };
      }

      // Get current rates to store with booking
      const ratesResult = await this.getRates();
      console.log('📊 Rate fetch result:', ratesResult);
      const currentRates = ratesResult.success ? ratesResult.rates : { twoMan: 70, threeMan: 100, fourMan: 130 };
      // Convert crew size number to proper key format
      const crewSizeMap = {
        '2': 'twoMan',
        '3': 'threeMan', 
        '4': 'fourMan'
      };
      const crewSizeKey = crewSizeMap[bookingData.crewSize.toString()];
      const currentRate = currentRates[crewSizeKey] || 0;
      
      console.log('📊 Booking rate calculation:', {
        crewSize: bookingData.crewSize,
        crewSizeKey,
        currentRates,
        currentRate,
        fallbackUsed: !ratesResult.success
      });

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
          hourlyRate: currentRate,
          yardAcreage: bookingData.yardAcreage,
          services: bookingData.services,
          preferredHour: bookingData.preferredHour || '',
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
        // Real MongoDB operation - POST to backend API
        console.log('✅ Saving booking to MongoDB with rate:', {
          bookingId: booking.bookingId,
          crewSize: booking.service.crewSize,
          hourlyRate: booking.service.hourlyRate
        });
        console.log('📋 Full booking object:', booking);
        
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/bookings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(booking)
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('MongoDB save result:', result);
        
        // NOTE: DO NOT update calendar availability here - that's only set by admin via Edit Crews
        
        return { success: true, booking: result };
      } else {
        // Fallback to localStorage
        const bookings = this.getLocalBookings();
        bookings.push(booking);
        localStorage.setItem('dcd_bookings', JSON.stringify(bookings));
        
        // NOTE: DO NOT update calendar availability here - that's only set by admin via Edit Crews
        
        return { success: true, booking };
      }
    } catch (error) {
      console.error('Error creating booking:', error);
      return { success: false, error: error.message };
    }
  }

  async getBookings(filters = {}) {
    try {
      console.log('🗄️ isConnected:', this.isConnected);
      
      if (this.isConnected) {
        console.log('🗄️ Fetching bookings from MongoDB with filters:', filters);
        try {
          // Build query parameters
          const queryParams = new URLSearchParams();
          if (filters.date) queryParams.append('date', filters.date);
          if (filters.status) queryParams.append('status', filters.status);
          if (filters.email) queryParams.append('email', filters.email);
          
          const url = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}/api/bookings${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
          
          // Make API call to backend that connects to MongoDB
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const data = await response.json();
          console.log('🗄️ MongoDB bookings response:', data);
          return { success: true, bookings: data };
        } catch (apiError) {
          console.error('🗄️ API call failed, falling back to localStorage:', apiError);
          // Fall back to localStorage if API fails
          this.isConnected = false;
          // Prevent infinite loop by calling localStorage directly
          let bookings = this.getLocalBookings();
          
          // Apply filters directly here
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
      } else {
        // Fallback to localStorage
        console.log('🗄️ Using localStorage fallback for bookings');
        let bookings = this.getLocalBookings();
        console.log('🗄️ Raw bookings from localStorage:', bookings);
        
        // Log each booking structure
        bookings.forEach((booking, index) => {
          console.log(`🗄️ Booking ${index}:`, booking);
          console.log(`🗄️ Booking ${index} service date:`, booking.service?.date);
          console.log(`🗄️ Booking ${index} direct date:`, booking.date);
        });
        
        // Apply filters
        if (filters.date) {
          const filterDate = new Date(filters.date).toDateString();
          bookings = bookings.filter(b => new Date(b.service.date).toDateString() === filterDate);
          console.log('🗄️ After date filter:', bookings.length);
        }
        
        if (filters.status) {
          bookings = bookings.filter(b => b.status.current === filters.status);
          console.log('🗄️ After status filter:', bookings.length);
        }
        
        if (filters.email) {
          bookings = bookings.filter(b => b.customer.email === filters.email);
          console.log('🗄️ After email filter:', bookings.length);
        }
        
        console.log('🗄️ Final filtered bookings:', bookings);
        return { success: true, bookings };
      }
    } catch (error) {
      console.error('❌ Error fetching bookings:', error);
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
  // Get all calendar availability entries (for admin page)
  async getAllCalendarAvailability() {
    try {
      console.log('🗄️ getAllCalendarAvailability called');
      console.log('🗄️ isConnected:', this.isConnected);
      
      if (this.isConnected) {
        console.log('🗄️ Fetching all calendar availability from MongoDB');
        try {
          // Make API call to backend that connects to MongoDB
          const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}/api/calendar-availability`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const data = await response.json();
          console.log('🗄️ MongoDB calendar availability response:', data);
          return { success: true, availability: data };
        } catch (apiError) {
          console.error('🗄️ API call failed, falling back to localStorage:', apiError);
          // Fall back to localStorage if API fails
          this.isConnected = false;
          // Prevent infinite loop by calling localStorage directly
          const calendar = this.getLocalCalendar();
          const availabilityArray = Array.isArray(calendar) ? calendar : 
            Object.keys(calendar).map(dateString => ({
              date: dateString,
              bookings: calendar[dateString].bookings || calendar[dateString] || 0
            }));
          return { success: true, availability: availabilityArray };
        }
      } else {
        // Fallback to localStorage - updated to match MongoDB structure
        console.log('🗄️ Using localStorage fallback for all availability');
        const calendar = this.getLocalCalendar();
        console.log('🗄️ Local calendar data:', calendar);
        
        // Updated: localStorage now stores direct array format like MongoDB
        // localStorage format: [{ date: "2025-07-23", bookings: 1 }, ...]
        const availabilityArray = Array.isArray(calendar) ? calendar : 
          Object.keys(calendar).map(dateString => ({
            date: dateString,
            bookings: calendar[dateString].bookings || calendar[dateString] || 0
          }));
        
        console.log('🗄️ Converted to array:', availabilityArray);
        return { success: true, availability: availabilityArray };
      }
    } catch (error) {
      console.error('❌ Error fetching all calendar availability:', error);
      return { success: false, error: error.message };
    }
  }

  async getCalendarAvailability(date) {
    try {
      const dateString = new Date(date).toISOString().split('T')[0];
      console.log('🗄️ getCalendarAvailability called for:', dateString);
      console.log('🗄️ isConnected:', this.isConnected);
      
      if (this.isConnected) {
        // Real MongoDB query would go here
        console.log('🗄️ Fetching calendar availability from MongoDB:', dateString);
        return { success: true, availability: null };
      } else {
        // Fallback to localStorage with simplified structure
        console.log('🗄️ Using localStorage fallback');
        const calendar = this.getLocalCalendar();
        console.log('🗄️ Local calendar data:', calendar);
        const dayAvailability = calendar[dateString];
        // Check day availability
        
        const result = { 
          success: true, 
          availability: dayAvailability ? {
            date: dateString,
            bookings: dayAvailability.bookings || dayAvailability || 0
          } : null
        };
        console.log('🗄️ Returning result:', result);
        return result;
      }
    } catch (error) {
      console.error('❌ Error fetching calendar availability:', error);
      return { success: false, error: error.message };
    }
  }

  async updateCalendarAvailability(date, bookingChange = 0, crewCount = null) {
    try {
      const dateString = new Date(date).toISOString().split('T')[0];
      
      // SECURITY: Only allow crew count updates - booking changes should never happen
      if (crewCount === null) {
        console.error('🚫 SECURITY: updateCalendarAvailability called without crewCount - this should never happen!');
        console.error('🚫 Attempted bookingChange:', bookingChange, 'for date:', dateString);
        return { success: false, error: 'Only crew count updates are allowed' };
      }
      
      if (this.isConnected) {
        console.log('🗄️ Updating calendar availability in MongoDB:', dateString, { crewCount });
        try {
          // Only allow crewCount updates
          const requestBody = { 
            date: dateString,
            crewCount: crewCount
          };
          
          // Make API call to update MongoDB
          const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}/api/calendar-availability`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
          });
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const data = await response.json();
          console.log('🗄️ MongoDB update response:', data);
          return { success: true };
        } catch (apiError) {
          console.error('🗄️ API call failed, falling back to localStorage:', apiError);
          this.isConnected = false;
          return this.updateCalendarAvailability(date, 0, crewCount); // Pass 0 for bookingChange in fallback
        }
      } else {
        // Fallback to localStorage using new array format
        console.log('🗄️ Updating localStorage calendar availability');
        let calendar = this.getLocalCalendar();
        
        // Ensure calendar is in array format
        if (!Array.isArray(calendar)) {
          calendar = [];
        }
        
        // Find existing entry or create new one
        let existingEntry = calendar.find(entry => entry.date === dateString);
        
        if (!existingEntry) {
          existingEntry = {
            date: dateString,
            bookings: Math.max(0, crewCount)
          };
          calendar.push(existingEntry);
        } else {
          // Only allow admin crew count setting
          existingEntry.bookings = Math.max(0, crewCount);
        }
        
        console.log('🗄️ Updated calendar entry:', existingEntry);
        localStorage.setItem('dcd_calendar', JSON.stringify(calendar));
        return { success: true };
      }
    } catch (error) {
      console.error('❌ Error updating calendar availability:', error);
      return { success: false, error: error.message };
    }
  }

  async setDailyBookingLimit(date, maxBookings) {
    try {
      const dateString = new Date(date).toISOString().split('T')[0];
      
      if (this.isConnected) {
        // Real MongoDB operation would go here
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


  async updateRates(newRates) {
    try {
      if (this.isConnected) {
        try {
          const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}/api/team-rates`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(newRates)
          });
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const data = await response.json();
          return { success: true };
        } catch (apiError) {
          console.error('API call failed, falling back to localStorage:', apiError);
          this.isConnected = false;
          localStorage.setItem('teamRates', JSON.stringify(newRates));
          return { success: true };
        }
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
    const bookingsStr = localStorage.getItem('dcd_bookings') || '[]';
    console.log('🗄️ localStorage dcd_bookings raw string:', bookingsStr);
    const bookings = JSON.parse(bookingsStr);
    return bookings;
  }

  getLocalCalendar() {
    const calendar = JSON.parse(localStorage.getItem('dcd_calendar') || '{}');
    console.log('🗄️ getLocalCalendar returning:', calendar);
    return calendar;
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

  // Update existing booking
  async updateBooking(bookingId, bookingData) {
    try {
      if (this.isConnected) {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/bookings/${bookingId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(bookingData)
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('MongoDB update result:', result);
        return { success: true, booking: result };
      } else {
        // Fallback to localStorage
        const bookings = this.getLocalBookings();
        const bookingIndex = bookings.findIndex(b => b.bookingId === bookingId);
        
        if (bookingIndex === -1) {
          return { success: false, error: 'Booking not found' };
        }

        const updatedBooking = {
          ...bookings[bookingIndex],
          customer: {
            name: bookingData.name,
            email: bookingData.email,
            phone: bookingData.phone,
            address: bookingData.address
          },
          service: {
            ...bookings[bookingIndex].service,
            date: new Date(bookingData.date),
            crewSize: parseInt(bookingData.crewSize),
            yardAcreage: bookingData.yardAcreage,
            services: bookingData.services,
            notes: bookingData.notes || ''
          },
          updatedAt: new Date()
        };

        bookings[bookingIndex] = updatedBooking;
        localStorage.setItem('dcd_bookings', JSON.stringify(bookings));
        
        return { success: true, booking: updatedBooking };
      }
    } catch (error) {
      console.error('Error updating booking:', error);
      return { success: false, error: error.message };
    }
  }

  // Delete booking
  async deleteBooking(bookingId) {
    try {
      if (this.isConnected) {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/bookings/${bookingId}`, {
          method: 'DELETE'
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('MongoDB delete result:', result);
        return { success: true };
      } else {
        // Fallback to localStorage
        const bookings = this.getLocalBookings();
        const filteredBookings = bookings.filter(b => b.bookingId !== bookingId);
        
        if (filteredBookings.length === bookings.length) {
          return { success: false, error: 'Booking not found' };
        }

        localStorage.setItem('dcd_bookings', JSON.stringify(filteredBookings));
        return { success: true };
      }
    } catch (error) {
      console.error('Error deleting booking:', error);
      return { success: false, error: error.message };
    }
  }
}

export const mongoService = new MongoService();
export default mongoService;