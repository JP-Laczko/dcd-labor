// MongoDB Schema Definitions for DCD Labor
// This file defines the structure for all MongoDB collections

// Collection: bookings
export const bookingSchema = {
  _id: "ObjectId", // MongoDB auto-generated ID
  bookingId: "String", // Unique booking identifier (UUID)
  
  // Customer Information
  customer: {
    name: "String", // Required
    email: "String", // Required, validated email format
    phone: "String", // Required, validated phone format
    address: "String" // Required, service location
  },
  
  // Service Details
  service: {
    date: "Date", // Required, preferred service date
    timeSlot: "String", // Required, time slot in 24hr format: "09:00", "13:00"
    displayTime: "String", // Display format: "9AM", "1PM"
    crewSize: "Number", // Required, 2, 3, or 4 man crew
    hourlyRate: "Number", // Required, rate at time of booking
    yardAcreage: "String", // Required, yard size description
    services: ["String"], // Required, array of requested services
    notes: "String", // Optional, additional customer notes
    estimatedHours: "Number", // Optional, estimated job duration
    totalCost: "Number" // Optional, calculated total cost
  },
  
  // Booking Status
  status: {
    current: "String", // "pending", "confirmed", "in_progress", "completed", "cancelled"
    history: [{
      status: "String",
      timestamp: "Date",
      notes: "String"
    }]
  },
  
  // Payment Information
  payment: {
    depositAmount: "Number", // 50% deposit
    depositPaid: "Boolean", // Default false
    depositDate: "Date", // When deposit was paid
    finalAmount: "Number", // Remaining balance
    finalPaid: "Boolean", // Default false
    finalDate: "Date", // When final payment was made
    paymentMethod: "String" // "credit_card", "cash", etc.
  },
  
  // Administrative
  metadata: {
    createdAt: "Date", // Auto-generated
    updatedAt: "Date", // Auto-updated
    createdBy: "String", // "customer" or admin username
    assignedCrew: ["String"], // Array of crew member names
    internalNotes: "String", // Admin-only notes
    emailsSent: {
      customerConfirmation: "Boolean",
      dcdNotification: "Boolean",
      confirmationSent: "Boolean",
      reminderSent: "Boolean"
    }
  }
};

// Collection: calendar_availability
export const calendarAvailabilitySchema = {
  _id: "ObjectId", // MongoDB auto-generated ID
  
  // Date Information
  date: "Date", // Required, unique index
  dateString: "String", // YYYY-MM-DD format for easy querying
  
  // Availability Configuration
  availability: {
    maxBookings: "Number", // DEPRECATED: Use timeSlots instead
    currentBookings: "Number", // DEPRECATED: Use timeSlots instead
    isAvailable: "Boolean", // Calculated field: any available time slots
    
    // Time Slot Availability (replaces crew system)
    timeSlots: [{
      time: "String", // 24hr format: "09:00", "13:00", "15:00"
      displayTime: "String", // Display format: "9AM", "1PM", "3PM"
      isAvailable: "Boolean", // true if slot is open for booking
      bookingId: "ObjectId" // reference to booking if occupied, null if available
    }]
  },
  
  // Business Rules
  businessRules: {
    isDayOff: "Boolean", // Sundays, holidays, etc.
    isBlocked: "Boolean", // Manually blocked dates
    blockReason: "String", // Reason for blocking
    weather: "String", // Weather-related notes
    specialNotes: "String" // Any special considerations
  },
  
  // Booking References
  bookings: ["ObjectId"], // Array of booking IDs for this date
  
  // Administrative
  metadata: {
    createdAt: "Date", // Auto-generated
    updatedAt: "Date", // Auto-updated
    lastModifiedBy: "String" // Admin username who last modified
  }
};

// Collection: team_rates
export const teamRatesSchema = {
  _id: "ObjectId", // MongoDB auto-generated ID
  
  // Rate Configuration
  rates: {
    twoMan: "Number", // Hourly rate
    threeMan: "Number", // Hourly rate
    fourMan: "Number" // Hourly rate
  },
  
  // Version Control
  version: "Number", // Rate version number
  effectiveDate: "Date", // When these rates become effective
  
  // Administrative
  metadata: {
    createdAt: "Date",
    updatedAt: "Date",
    createdBy: "String", // Admin username
    notes: "String" // Reason for rate change
  }
};

// Collection: admin_users (for future multi-admin support)
export const adminUserSchema = {
  _id: "ObjectId",
  username: "String", // Unique
  email: "String", // Unique
  passwordHash: "String", // Hashed password
  role: "String", // "admin", "manager", "viewer"
  
  permissions: {
    canViewBookings: "Boolean",
    canEditBookings: "Boolean",
    canDeleteBookings: "Boolean",
    canManageCalendar: "Boolean",
    canManageRates: "Boolean",
    canManageUsers: "Boolean"
  },
  
  profile: {
    firstName: "String",
    lastName: "String",
    phone: "String"
  },
  
  session: {
    lastLogin: "Date",
    isActive: "Boolean"
  },
  
  metadata: {
    createdAt: "Date",
    updatedAt: "Date",
    createdBy: "String"
  }
};

// Database Indexes for Performance
export const recommendedIndexes = {
  bookings: [
    { "customer.email": 1 },
    { "service.date": 1 },
    { "status.current": 1 },
    { "metadata.createdAt": -1 },
    { "bookingId": 1 } // Unique
  ],
  
  calendar_availability: [
    { "date": 1 }, // Unique
    { "dateString": 1 }, // Unique
    { "availability.isAvailable": 1 },
    { "businessRules.isDayOff": 1 }
  ],
  
  team_rates: [
    { "effectiveDate": -1 },
    { "version": -1 }
  ],
  
  admin_users: [
    { "username": 1 }, // Unique
    { "email": 1 }, // Unique
    { "session.isActive": 1 }
  ]
};

// Sample Data for Testing
export const sampleData = {
  // Sample booking
  sampleBooking: {
    bookingId: "booking_123456789",
    customer: {
      name: "John Smith",
      email: "john.smith@email.com",
      phone: "(555) 123-4567",
      address: "123 Oak Street, Athens, GA 30601"
    },
    service: {
      date: new Date("2024-03-15"),
      timeSlot: "09:00",
      displayTime: "9AM",
      crewSize: 2,
      hourlyRate: 85,
      yardAcreage: "0.5 acres",
      services: ["Leaf Removal", "Lawn Mowing", "Hedge Trimming"],
      notes: "Please avoid the flower beds near the front porch",
      estimatedHours: 4,
      totalCost: 340
    },
    status: {
      current: "pending",
      history: [{
        status: "pending",
        timestamp: new Date(),
        notes: "Initial booking submitted"
      }]
    },
    payment: {
      depositAmount: 170,
      depositPaid: false,
      finalAmount: 170,
      finalPaid: false,
      paymentMethod: "credit_card"
    },
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: "customer",
      emailsSent: {
        customerConfirmation: true,
        dcdNotification: true,
        confirmationSent: false,
        reminderSent: false
      }
    }
  },
  
  // Sample calendar availability
  sampleCalendarDay: {
    date: new Date("2024-03-15"),
    dateString: "2024-03-15",
    availability: {
      maxBookings: 2, // DEPRECATED: derived from timeSlots.length
      currentBookings: 0, // DEPRECATED: derived from occupied timeSlots
      isAvailable: true, // true if any timeSlots are available
      timeSlots: [
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
        }
      ]
    },
    businessRules: {
      isDayOff: false,
      isBlocked: false,
      blockReason: null,
      weather: null,
      specialNotes: null
    },
    bookings: [],
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      lastModifiedBy: "admin"
    }
  },
  
  // Sample team rates
  sampleRates: {
    rates: {
      twoMan: 85,
      threeMan: 117,
      fourMan: 140
    },
    version: 1,
    effectiveDate: new Date(),
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: "admin",
      notes: "Initial rate setup"
    }
  }
};

export default {
  bookingSchema,
  calendarAvailabilitySchema,
  teamRatesSchema,
  adminUserSchema,
  recommendedIndexes,
  sampleData
};