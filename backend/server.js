import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import { Resend } from 'resend';
// Remove Square SDK - we'll use direct HTTP requests
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';

// Load environment-specific config
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
dotenv.config({ path: envFile });

// Fallback to default .env if environment-specific file doesn't exist
if (!process.env.MONGODB_URI) {
  dotenv.config();
}

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);
console.log('🔑 Resend API Key configured:', process.env.RESEND_API_KEY ? 'Yes' : 'No');
console.log('📧 DCD Email configured:', process.env.DCD_EMAIL ? 'Yes' : 'No');

// Square API Configuration
const squareConfig = {
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  baseUrl: process.env.NODE_ENV === 'production' 
    ? 'https://connect.squareup.com' 
    : 'https://connect.squareupsandbox.com',
  locationId: process.env.SQUARE_LOCATION_ID
};

// Square API Helper Functions
async function makeSquareRequest(endpoint, method = 'GET', body = null) {
  const url = `${squareConfig.baseUrl}/v2${endpoint}`;
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${squareConfig.accessToken}`,
      'Content-Type': 'application/json',
      'Square-Version': '2023-10-18'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  console.log(`💳🔍 Making Square API request: ${method} ${url}`);
  
  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    console.error(`💳❌ Square API error: ${response.status}`, data);
    const error = new Error(`Square API error: ${response.status}`);
    error.squareErrors = data.errors;
    error.statusCode = response.status;
    throw error;
  }

  console.log(`💳✅ Square API success: ${response.status}`);
  return data;
}

// Initialize and test Square connection
if (process.env.SQUARE_ACCESS_TOKEN) {
  console.log('💳 NODE_ENV:', process.env.NODE_ENV);
  console.log('💳 Square base URL:', squareConfig.baseUrl);
  console.log('💳 Access token length:', process.env.SQUARE_ACCESS_TOKEN?.length);
  console.log('💳 Access token starts with:', process.env.SQUARE_ACCESS_TOKEN?.substring(0, 10) + '...');
  
  // Test the connection by fetching locations
  try {
    const locations = await makeSquareRequest('/locations');
    if (locations.locations && locations.locations.length > 0) {
      console.log('💳 Available locations:', locations.locations.map(loc => `${loc.id}: ${loc.name}`));
      console.log('💳 Using location ID:', process.env.SQUARE_LOCATION_ID);
      const targetLocation = locations.locations.find(loc => loc.id === process.env.SQUARE_LOCATION_ID);
      if (targetLocation) {
        console.log('💳 ✅ Location ID matches available location:', targetLocation.name);
      } else {
        console.log('💳 ⚠️ Location ID not found in available locations!');
      }
    }
    console.log('💳 Square API connection successful');
  } catch (error) {
    console.error('💳 ⚠️ Square API connection test failed:', error.message);
  }
} else {
  console.log('💳 Square credentials not provided - payment features disabled');
}

console.log('💳 Square Access Token configured:', process.env.SQUARE_ACCESS_TOKEN ? 'Yes' : 'No');
console.log('🏪 Square Application ID configured:', process.env.SQUARE_APPLICATION_ID ? 'Yes' : 'No');
console.log('📍 Square Location ID configured:', process.env.SQUARE_LOCATION_ID ? 'Yes' : 'No');

// Email configuration based on environment
const getEmailConfig = () => {
  const isDomainVerified = process.env.DOMAIN_VERIFIED === 'true';
  
  if (isDomainVerified) {
    return {
      customerFrom: 'DCD Labor <booking@dcdlabor.com>',
      adminFrom: 'DCD Labor System <noreply@dcdlabor.com>',
      from: 'DCD Labor System <noreply@dcdlabor.com>',
      to: process.env.DCD_EMAIL,
      sendToCustomer: true
    };
  } else {
    return {
      customerFrom: 'DCD Labor <onboarding@resend.dev>',
      adminFrom: 'DCD Labor System <onboarding@resend.dev>',
      from: 'DCD Labor System <onboarding@resend.dev>',
      to: process.env.DCD_EMAIL,
      sendToCustomer: false // Send customer emails to admin for testing
    };
  }
};

// MongoDB connection
let db;
const client = new MongoClient(process.env.MONGODB_URI);

// Determine frontend URL based on environment
const getFrontendUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    // Allow multiple production origins
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'https://dcdlabor.com',
      'https://www.dcdlabor.com'
    ].filter(Boolean);
    return allowedOrigins.length > 1 ? allowedOrigins : allowedOrigins[0];
  }
  return process.env.FRONTEND_URL || 'http://localhost:5173';
};

// Middleware
app.use(cors({
  origin: getFrontendUrl(),
  credentials: true
}));
app.use(express.json());

// Connect to MongoDB with retry logic for serverless
async function connectToMongo() {
  try {
    await client.connect();
    db = client.db(process.env.MONGODB_DB_NAME);
    console.log('✅ Connected to MongoDB successfully');
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    db = null;
    return false;
  }
}

// Health check endpoint with database connection test
app.get('/api/health', async (req, res) => {
  try {
    // Try to connect if not already connected
    if (!db) {
      await connectToMongo();
    }
    
    // Test the database connection
    if (db) {
      await db.admin().ping();
    }
    
    res.json({ 
      status: 'OK', 
      message: 'DCD Labor API is running',
      timestamp: new Date().toISOString(),
      database: db ? 'Connected' : 'Disconnected'
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: 'Health check failed',
      timestamp: new Date().toISOString(),
      database: 'Failed',
      error: error.message
    });
  }
});

// UTILITY FUNCTIONS

// Generate default time slots for a given date (matches frontend logic)
function generateDefaultTimeSlots(date) {
  const august25 = new Date('2024-08-25');
  const isAfterAugust25 = date >= august25;
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
  
  let slots = [];
  
  if (isAfterAugust25) {
    // August 25+ rules: weekdays 3PM only, weekends 9AM and 1PM
    if (isWeekend) {
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
        }
      ];
    } else {
      // Weekday - only 3PM
      slots = [
        {
          time: "15:00",
          displayTime: "3PM", 
          isAvailable: true,
          bookingId: null
        }
      ];
    }
  } else {
    // Before August 25: default 9AM and 1PM for all days
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
      }
    ];
  }
  
  return slots;
}

// CALENDAR AVAILABILITY ENDPOINTS

// GET /api/calendar-availability - Get all calendar availability
app.get('/api/calendar-availability', async (req, res) => {
  try {
    // Ensure database connection
    if (!db) {
      const connected = await connectToMongo();
      if (!connected) {
        return res.status(500).json({ error: 'Database connection failed' });
      }
    }
    const collection = db.collection('calendar_availability');
    const documents = await collection.find({}).toArray();
    
    // Transform MongoDB documents to expected format (support both old and new schema)
    const availability = documents.map(doc => {
      // Handle both old format {date, bookings} and new format {date, availability: {...}}
      if (doc.availability) {
        // New format - document has availability.timeSlots structure
        // Respect admin's explicit configuration - don't auto-generate if timeSlots exists (even if empty)
        return {
          date: doc.date,
          bookings: doc.availability.maxBookings || 0, // DEPRECATED: kept for backward compatibility
          availability: doc.availability
        };
      } else {
        // Old format - document only has {date, bookings}
        // Generate proper default time slots based on date
        const date = new Date(doc.date);
        const defaultTimeSlots = generateDefaultTimeSlots(date);
        
        return {
          date: doc.date,
          bookings: doc.bookings || 0, // DEPRECATED: kept for backward compatibility  
          availability: {
            maxBookings: doc.bookings || 0,
            currentBookings: 0,
            isAvailable: (doc.bookings || 0) > 0,
            timeSlots: defaultTimeSlots
          }
        };
      }
    });
    
    // Now fetch all bookings and mark corresponding time slots as unavailable
    try {
      const bookingsCollection = db.collection('bookings');
      const bookings = await bookingsCollection.find({}).toArray();
      
      // Process bookings to mark time slots as unavailable
      bookings.forEach(booking => {
        if (booking.service && booking.service.timeSlot) {
          const bookingDate = new Date(booking.service.date).toISOString().split('T')[0];
          const bookingTimeSlot = booking.service.timeSlot;
          
          // Find the corresponding availability entry
          const availabilityEntry = availability.find(entry => entry.date === bookingDate);
          if (availabilityEntry && availabilityEntry.availability && availabilityEntry.availability.timeSlots) {
            // Mark the time slot as unavailable
            availabilityEntry.availability.timeSlots.forEach(slot => {
              if (slot.time === bookingTimeSlot) {
                slot.isAvailable = false;
                slot.bookingId = booking.bookingId || booking._id;
              }
            });
          }
        }
      });
    } catch (bookingError) {
      console.error('⚠️ Error processing bookings for time slot availability:', bookingError);
      // Continue without booking integration if it fails
    }
    
    res.json(availability);
  } catch (error) {
    console.error('❌ Error fetching calendar availability:', error);
    res.status(500).json({ error: 'Failed to fetch calendar availability' });
  }
});

// PUT /api/calendar-availability - Update calendar availability (ADMIN ONLY - crew count setting)
app.put('/api/calendar-availability', async (req, res) => {
  try {
    // Ensure database connection
    if (!db) {
      await connectToMongo();
    }
    const { date, crewCount } = req.body;
    console.log(`📅 PUT /api/calendar-availability - Date: ${date}, CrewCount: ${crewCount}`);
    
    // SECURITY: Only allow crewCount updates - never allow bookingChange
    if (crewCount === undefined) {
      return res.status(400).json({ error: 'crewCount must be provided' });
    }
    
    const collection = db.collection('calendar_availability');
    
    // Find existing document or create new one
    const existingDoc = await collection.findOne({ date });
    
    // Absolute crew count setting (from Edit Crews modal ONLY)
    const newBookings = Math.max(0, crewCount);
    console.log(`📅 Setting absolute crew count for ${date}: ${newBookings}`);
    
    if (existingDoc) {
      // Update existing document
      await collection.updateOne(
        { date },
        { $set: { bookings: newBookings } }
      );
      console.log(`📅 Updated ${date}: ${existingDoc.bookings} -> ${newBookings}`);
    } else {
      // Create new document
      await collection.insertOne({
        date,
        bookings: newBookings
      });
      console.log(`📅 Created ${date} with ${newBookings} bookings`);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error updating calendar availability:', error);
    res.status(500).json({ error: 'Failed to update calendar availability' });
  }
});

// PUT /api/calendar-time-slots - Update time slots for a specific date (NEW TIME SLOT SYSTEM)
app.put('/api/calendar-time-slots', async (req, res) => {
  try {
    // Ensure database connection
    if (!db) {
      await connectToMongo();
    }
    
    const { date, timeSlots } = req.body;
    console.log(`📅 PUT /api/calendar-time-slots - Date: ${date}, TimeSlots:`, timeSlots);
    
    if (!date || !timeSlots || !Array.isArray(timeSlots)) {
      return res.status(400).json({ error: 'date and timeSlots array are required' });
    }
    
    const collection = db.collection('calendar_availability');
    
    // Find existing document or create new one
    const existingDoc = await collection.findOne({ date });
    
    const updateDoc = {
      date,
      availability: {
        maxBookings: timeSlots.length, // DEPRECATED but kept for compatibility
        currentBookings: timeSlots.filter(slot => !slot.isAvailable).length,
        isAvailable: timeSlots.some(slot => slot.isAvailable),
        timeSlots: timeSlots
      },
      businessRules: existingDoc?.businessRules || {
        isDayOff: false,
        isBlocked: false,
        blockReason: null,
        weather: null,
        specialNotes: null
      },
      bookings: existingDoc?.bookings || [],
      metadata: {
        ...existingDoc?.metadata,
        updatedAt: new Date(),
        lastModifiedBy: 'admin'
      }
    };
    
    // If document doesn't exist, add creation metadata
    if (!existingDoc) {
      updateDoc.metadata.createdAt = new Date();
    }
    
    const result = await collection.replaceOne(
      { date },
      updateDoc,
      { upsert: true }
    );
    
    console.log(`📅 Time slots updated for ${date}: ${result.modifiedCount} modified, ${result.upsertedCount} inserted`);
    
    res.json({ 
      success: true, 
      message: `Time slots updated for ${date}`,
      timeSlots: timeSlots
    });
    
  } catch (error) {
    console.error('❌ Error updating calendar time slots:', error);
    res.status(500).json({ error: 'Failed to update calendar time slots' });
  }
});

// PUT /api/calendar-mark-slot-booked - Mark a specific time slot as booked
app.put('/api/calendar-mark-slot-booked', async (req, res) => {
  try {
    // Ensure database connection
    if (!db) {
      await connectToMongo();
    }
    
    const { date, timeSlot, bookingId } = req.body;
    console.log(`📅 PUT /api/calendar-mark-slot-booked - Date: ${date}, TimeSlot: ${timeSlot}, BookingId: ${bookingId}`);
    
    if (!date || !timeSlot || !bookingId) {
      return res.status(400).json({ error: 'date, timeSlot, and bookingId are required' });
    }
    
    const collection = db.collection('calendar_availability');
    
    // Find the document for this date
    const existingDoc = await collection.findOne({ date });
    
    if (!existingDoc || !existingDoc.availability || !existingDoc.availability.timeSlots) {
      return res.status(404).json({ error: 'No time slots found for this date' });
    }
    
    // Update the specific time slot
    const updatedTimeSlots = existingDoc.availability.timeSlots.map(slot => {
      if (slot.time === timeSlot) {
        return {
          ...slot,
          isAvailable: false,
          bookingId: bookingId
        };
      }
      return slot;
    });
    
    // Update the document
    const updateDoc = {
      ...existingDoc,
      availability: {
        ...existingDoc.availability,
        timeSlots: updatedTimeSlots,
        currentBookings: updatedTimeSlots.filter(slot => !slot.isAvailable).length,
        isAvailable: updatedTimeSlots.some(slot => slot.isAvailable)
      },
      metadata: {
        ...existingDoc.metadata,
        updatedAt: new Date(),
        lastModifiedBy: 'booking-system'
      }
    };
    
    const result = await collection.replaceOne({ date }, updateDoc);
    
    console.log(`📅 Time slot marked as booked for ${date}: ${result.modifiedCount} modified`);
    res.json({ 
      success: true, 
      message: `Time slot ${timeSlot} marked as booked for ${date}`,
      timeSlots: updatedTimeSlots
    });
    
  } catch (error) {
    console.error('❌ Error marking time slot as booked:', error);
    res.status(500).json({ error: 'Failed to mark time slot as booked' });
  }
});

// CLEANUP ENDPOINTS

// DELETE /api/cleanup/past-dates - Remove past calendar availability and bookings to save space
app.delete('/api/cleanup/past-dates', async (req, res) => {
  try {
    // Ensure database connection
    if (!db) {
      await connectToMongo();
    }
    
    const today = new Date().toISOString().split('T')[0];
    console.log('🧹 Cleaning up past dates before:', today);
    
    // Delete past calendar availability
    const calendarCollection = db.collection('calendar_availability');
    const calendarResult = await calendarCollection.deleteMany({
      date: { $lt: today }
    });
    
    // Delete past bookings (optional - you might want to keep for records)
    const bookingsCollection = db.collection('bookings');
    const bookingsResult = await bookingsCollection.deleteMany({
      $or: [
        { 'service.date': { $lt: new Date(today) } },
        { 'date': { $lt: new Date(today) } }
      ]
    });
    
    console.log('🧹 Cleanup complete:', {
      calendarEntriesDeleted: calendarResult.deletedCount,
      bookingsDeleted: bookingsResult.deletedCount
    });
    
    res.json({ 
      success: true, 
      deleted: {
        calendarEntries: calendarResult.deletedCount,
        bookings: bookingsResult.deletedCount
      }
    });
  } catch (error) {
    console.error('❌ Error cleaning up past dates:', error);
    res.status(500).json({ error: 'Failed to cleanup past dates' });
  }
});

// DELETE /api/cleanup/past-calendar-only - Remove only past calendar availability (keep bookings for records)
app.delete('/api/cleanup/past-calendar-only', async (req, res) => {
  try {
    // Ensure database connection
    if (!db) {
      await connectToMongo();
    }
    
    const today = new Date().toISOString().split('T')[0];
    console.log('🧹 Cleaning up past calendar availability before:', today);
    
    // Delete only past calendar availability, keep bookings for historical records
    const calendarCollection = db.collection('calendar_availability');
    const result = await calendarCollection.deleteMany({
      date: { $lt: today }
    });
    
    console.log('🧹 Calendar cleanup complete:', {
      calendarEntriesDeleted: result.deletedCount
    });
    
    res.json({ 
      success: true, 
      deleted: {
        calendarEntries: result.deletedCount
      }
    });
  } catch (error) {
    console.error('❌ Error cleaning up past calendar dates:', error);
    res.status(500).json({ error: 'Failed to cleanup past calendar dates' });
  }
});

// BOOKINGS ENDPOINTS

// GET /api/bookings - Get all bookings with optional filters
app.get('/api/bookings', async (req, res) => {
  try {
    // Ensure database connection
    if (!db) {
      await connectToMongo();
    }
    const { date, status, email } = req.query;
    
    const collection = db.collection('bookings');
    
    // Build MongoDB filter
    const filter = {};
    if (date) {
      filter['service.date'] = date;
    }
    if (status) {
      filter['status.current'] = status;
    }
    if (email) {
      filter['customer.email'] = email;
    }
    
    const documents = await collection.find(filter).toArray();
    
    // console.log('📋 Bookings from MongoDB:', documents);
    
    res.json(documents);
  } catch (error) {
    console.error('❌ Error fetching bookings:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// POST /api/bookings - Create new booking
app.post('/api/bookings', async (req, res) => {
  try {
    // Ensure database connection
    if (!db) {
      await connectToMongo();
    }
    const bookingData = req.body;
    console.log('📋 POST /api/bookings - Creating booking for:', bookingData.customer?.name || 'unknown customer');
    
    const collection = db.collection('bookings');
    
    // Add timestamp and generate ID if not provided
    const booking = {
      ...bookingData,
      bookingId: bookingData.bookingId || `booking_${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await collection.insertOne(booking);
    console.log('📋 Created booking:', result.insertedId);
    
    res.json({ success: true, bookingId: booking.bookingId, _id: result.insertedId });
  } catch (error) {
    console.error('❌ Error creating booking:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// PUT /api/bookings/:id - Update existing booking with time slot management
app.put('/api/bookings/:id', async (req, res) => {
  try {
    // Ensure database connection
    if (!db) {
      await connectToMongo();
    }
    const { id } = req.params;
    const bookingData = req.body;
    console.log('📋 PUT /api/bookings/:id - Updating booking ID:', id, 'for customer:', bookingData.customer?.name || bookingData.name || 'unknown customer');
    
    const collection = db.collection('bookings');
    const calendarCollection = db.collection('calendar_availability');
    
    // First, get the existing booking to compare changes
    const existingBooking = await collection.findOne({ bookingId: id });
    if (!existingBooking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    // Extract old and new time slot information
    const oldDate = existingBooking.service?.date instanceof Date 
      ? existingBooking.service.date.toISOString().split('T')[0]
      : existingBooking.service?.date;
    const oldTimeSlot = existingBooking.service?.timeSlot;
    
    const newDate = bookingData.date;
    const newTimeSlot = bookingData.timeSlot;
    
    console.log('📅 Time slot changes:', { oldDate, oldTimeSlot, newDate, newTimeSlot });
    
    // Handle time slot changes
    const timeSlotChanged = oldDate !== newDate || oldTimeSlot !== newTimeSlot;
    
    if (timeSlotChanged) {
      // Free up the old time slot if it exists
      if (oldDate && oldTimeSlot) {
        console.log('📅 Freeing old time slot:', { date: oldDate, timeSlot: oldTimeSlot });
        const oldCalendarEntry = await calendarCollection.findOne({ date: oldDate });
        
        if (oldCalendarEntry && oldCalendarEntry.availability && oldCalendarEntry.availability.timeSlots) {
          const updatedOldSlots = oldCalendarEntry.availability.timeSlots.map(slot => {
            if (slot.time === oldTimeSlot) {
              return { ...slot, isAvailable: true, bookingId: null };
            }
            return slot;
          });
          
          await calendarCollection.updateOne(
            { date: oldDate },
            { 
              $set: { 
                'availability.timeSlots': updatedOldSlots,
                updatedAt: new Date()
              } 
            }
          );
          console.log('📅 ✅ Freed old time slot');
        }
      }
      
      // Book the new time slot if it exists
      if (newDate && newTimeSlot) {
        console.log('📅 Booking new time slot:', { date: newDate, timeSlot: newTimeSlot });
        const newCalendarEntry = await calendarCollection.findOne({ date: newDate });
        
        if (newCalendarEntry && newCalendarEntry.availability && newCalendarEntry.availability.timeSlots) {
          const updatedNewSlots = newCalendarEntry.availability.timeSlots.map(slot => {
            if (slot.time === newTimeSlot) {
              return { ...slot, isAvailable: false, bookingId: id };
            }
            return slot;
          });
          
          await calendarCollection.updateOne(
            { date: newDate },
            { 
              $set: { 
                'availability.timeSlots': updatedNewSlots,
                updatedAt: new Date()
              } 
            }
          );
          console.log('📅 ✅ Booked new time slot');
        }
      }
    }
    
    // Build the updated booking object
    const updatedBooking = {
      customer: {
        name: bookingData.name,
        email: bookingData.email,
        phone: bookingData.phone,
        address: bookingData.address
      },
      service: {
        date: bookingData.date,
        crewSize: parseInt(bookingData.crewSize),
        hourlyRate: bookingData.hourlyRate || existingBooking.service?.hourlyRate || 0,
        services: bookingData.services,
        timeSlot: bookingData.timeSlot || '',
        displayTime: bookingData.displayTime || '',
        serviceType: bookingData.serviceType || 'hourly',
        notes: bookingData.notes || '',
        leafHaul: bookingData.leafHaul !== undefined ? bookingData.leafHaul : existingBooking.service?.leafHaul || false
      },
      updatedAt: new Date()
    };
    
    // Update the booking
    const result = await collection.updateOne(
      { bookingId: id },
      { $set: updatedBooking }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    console.log('📋 ✅ Updated booking:', id);
    res.json({ success: true, bookingId: id });
  } catch (error) {
    console.error('❌ Error updating booking:', error);
    res.status(500).json({ error: 'Failed to update booking' });
  }
});

// DELETE /api/bookings/:id - Delete booking and free up time slot
app.delete('/api/bookings/:id', async (req, res) => {
  try {
    // Ensure database connection
    if (!db) {
      await connectToMongo();
    }
    const { id } = req.params;
    console.log('📋 DELETE /api/bookings/:id - ID:', id);
    
    const collection = db.collection('bookings');
    
    // First, find the booking to get its date and time slot info
    const booking = await collection.findOne({ bookingId: id });
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    // Delete the booking
    const result = await collection.deleteOne({ bookingId: id });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    // Free up the time slot if booking has time slot information
    if (booking.service && booking.service.date && booking.service.timeSlot) {
      try {
        const calendarCollection = db.collection('calendar_availability');
        // Handle both Date objects and string dates
        const dateString = booking.service.date instanceof Date 
          ? booking.service.date.toISOString().split('T')[0] 
          : booking.service.date;
        const timeSlot = booking.service.timeSlot;
        
        console.log('📅 Freeing up time slot:', { date: dateString, timeSlot });
        
        // Find the calendar entry for this date
        const calendarEntry = await calendarCollection.findOne({ date: dateString });
        
        console.log('📅 Calendar entry found:', {
          found: !!calendarEntry,
          hasAvailability: !!(calendarEntry?.availability),
          hasTimeSlots: !!(calendarEntry?.availability?.timeSlots),
          timeSlotsCount: calendarEntry?.availability?.timeSlots?.length || 0
        });
        
        if (calendarEntry && calendarEntry.availability && calendarEntry.availability.timeSlots) {
          // Find and update the specific time slot to make it available
          const timeSlots = calendarEntry.availability.timeSlots.map(slot => {
            if (slot.time === timeSlot) {
              return { ...slot, isAvailable: true, bookingId: null };
            }
            return slot;
          });
          
          // Update the calendar entry
          await calendarCollection.updateOne(
            { date: dateString },
            { 
              $set: { 
                'availability.timeSlots': timeSlots,
                updatedAt: new Date()
              } 
            }
          );
          
          console.log('📅 Successfully freed up time slot:', timeSlot, 'on', dateString);
        }
      } catch (calendarError) {
        console.error('⚠️ Error freeing up time slot:', calendarError);
        // Don't fail the entire operation if calendar update fails
      }
    }
    
    console.log('📋 Deleted booking:', id);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting booking:', error);
    res.status(500).json({ error: 'Failed to delete booking' });
  }
});

// TEAM RATES ENDPOINTS

// GET /api/team-rates - Get team rates
app.get('/api/team-rates', async (req, res) => {
  try {
    // Ensure database connection
    if (!db) {
      await connectToMongo();
    }
    const collection = db.collection('team_rates');
    const document = await collection.findOne({});
    
    // console.log('💰 Team rates document from MongoDB:', document);
    
    if (document) {
      // Remove MongoDB _id field from response
      const { _id, ...rates } = document;
      res.json(rates);
    } else {
      // Return default rates if none found
      const defaultRates = {
        twoMan: 70,
        threeMan: 100,
        fourMan: 130
      };
      console.log('💰 No team rates found in database, returning default rates:', defaultRates);
      res.json(defaultRates);
    }
  } catch (error) {
    console.error('❌ Error fetching team rates:', error);
    res.status(500).json({ error: 'Failed to fetch team rates' });
  }
});

// PUT /api/team-rates - Update team rates
app.put('/api/team-rates', async (req, res) => {
  try {
    // Ensure database connection
    if (!db) {
      await connectToMongo();
    }
    const rates = req.body;
    console.log('💰 PUT /api/team-rates - Updating rates with:', rates);
    
    const collection = db.collection('team_rates');
    
    // Upsert (update or insert) the rates document
    const result = await collection.replaceOne(
      {}, // Match any document (assuming only one rates document)
      rates,
      { upsert: true }
    );
    
    console.log('💰 Team rates update result:', { 
      matchedCount: result.matchedCount, 
      modifiedCount: result.modifiedCount, 
      upsertedId: result.upsertedId 
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error updating team rates:', error);
    res.status(500).json({ error: 'Failed to update team rates' });
  }
});

// EMAIL ENDPOINTS

// POST /api/send-email - Send booking confirmation emails
app.post('/api/send-email', async (req, res) => {
  try {
    // Ensure database connection
    if (!db) {
      await connectToMongo();
    }
    const { bookingData } = req.body;
    console.log('📧 POST /api/send-email - Sending email for:', bookingData.customer?.name || bookingData.name || 'unknown customer');
    console.log('📧 BookingData structure:', JSON.stringify(bookingData, null, 2));
    
    if (!process.env.RESEND_API_KEY || !process.env.DCD_EMAIL) {
      return res.status(500).json({ error: 'Email configuration missing' });
    }

    // Send customer confirmation email
    const customerEmail = await sendCustomerConfirmation(bookingData, process.env.RESEND_API_KEY, process.env.DCD_EMAIL);
    
    // Send DCD notification email
    const dcdEmail = await sendDCDNotification(bookingData, process.env.RESEND_API_KEY, process.env.DCD_EMAIL);

    console.log('📧 Emails sent successfully');
    res.json({ 
      success: true, 
      message: 'Confirmation emails sent successfully',
      details: {
        customerEmail: customerEmail,
        dcdEmail: dcdEmail
      }
    });
  } catch (error) {
    console.error('❌ Error sending emails:', error);
    res.status(500).json({ error: 'Failed to send emails', details: error.message });
  }
});

// GET /api/email-preview - Preview email templates
app.get('/api/email-preview', async (req, res) => {
  try {
    const { type = 'customer' } = req.query;
    
    // Sample booking data for preview
    const sampleBookingData = {
      customer: {
        name: 'John Smith',
        email: 'john.smith@example.com',
        phone: '(555) 123-4567'
      },
      service: {
        date: '2024-02-15',
        teamSize: '3',
        address: '123 Main Street, Athens, GA 30601',
        rate: '250'
      },
      services: ['Lawn Mowing', 'Leaf Removal', 'Hedge Trimming'],
      timeSlot: '09:00',
      displayTime: '9AM',
      serviceType: 'estimate',
      notes: 'Please be careful around the flower beds near the front entrance.'
    };

    let htmlContent;
    if (type === 'customer') {
      htmlContent = await generateCustomerEmailPreview(sampleBookingData, process.env.DCD_EMAIL);
    } else if (type === 'review') {
      htmlContent = await generateGoogleReviewEmailPreview(sampleBookingData, process.env.DCD_EMAIL);
    } else if (type === 'quote-customer') {
      // Quote customer confirmation email
      const sampleQuoteData = {
        name: 'John Smith',
        email: 'john.smith@example.com',
        phone: '(555) 123-4567',
        address: '123 Main Street, Athens, GA 30601',
        services: ['Mulching', 'Brush removal', 'Log splitting'],
          notes: 'Please contact me in the morning. Updated preview.',
        leafHaul: true,
        submittedAt: new Date().toISOString()
      };
      const { from: fromEmail, to: dcdEmail } = getEmailConfig();
      const servicesList = sampleQuoteData.services.join(', ');
      const leafHaulText = sampleQuoteData.leafHaul ? ' (+ Leaf Haul Service $280)' : '';
      
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #22c55e; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .booking-details { background: white; padding: 15px; margin: 15px 0; border-radius: 8px; }
            .detail-row { padding: 8px 0; border-bottom: 1px solid #eee; }
            .detail-label { font-weight: bold; min-width: 180px; display: inline-block; vertical-align: top; }
            .detail-value { display: inline-block; vertical-align: top; }
            .services-list { margin: 10px 0; }
            .service-item { padding: 5px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>DCD Labor - Quote Request Received</h1>
              <p>Thank you for your interest in our landscaping services!</p>
            </div>
            
            <div class="content">
              <h2>Hello ${sampleQuoteData.name},</h2>
              <p>We've received your quote request and will get back to you within 48 hours with a detailed estimate.</p>
              
              <div class="booking-details">
                <h3>Quote Request Details</h3>
                
                <div class="detail-row">
                  <span class="detail-label">Name:</span>
                  <span class="detail-value">${sampleQuoteData.name}</span>
                </div>
                
                <div class="detail-row">
                  <span class="detail-label">Email:</span>
                  <span class="detail-value">${sampleQuoteData.email}</span>
                </div>
                
                <div class="detail-row">
                  <span class="detail-label">Phone:</span>
                  <span class="detail-value">${sampleQuoteData.phone}</span>
                </div>
                
                <div class="detail-row">
                  <span class="detail-label">Service Address:</span>
                  <span class="detail-value">${sampleQuoteData.address}</span>
                </div>
                
                <div class="services-list">
                  <div class="detail-row">
                    <span class="detail-label">Services Requested:</span>
                    <span class="detail-value">
                      ${sampleQuoteData.services.map(service => `<div class="service-item">• ${service}</div>`).join('')}
                      ${sampleQuoteData.leafHaul ? '<div class="service-item">• Leaf Haul Service (+$280)</div>' : ''}
                    </span>
                  </div>
                </div>
                
                ${sampleQuoteData.notes ? `
                <div class="detail-row">
                  <span class="detail-label">Additional Notes:</span>
                  <span class="detail-value">${sampleQuoteData.notes}</span>
                </div>
                ` : ''}
              </div>
              
              <h3>What's Next?</h3>
              <ul>
                <li>We'll review your request and prepare a detailed quote</li>
                <li>You'll receive our estimate within 48 hours</li>
              </ul>
              
              <p>If you have any questions or need to make changes to your request, please contact us at:</p>
              <p><strong>Email:</strong> ${dcdEmail}<br>
              <strong>Phone:</strong> (973) 945-2076</p>
              
              <p>Thank you for choosing DCD Labor!</p>
            </div>
            
            <div class="footer">
              <p>DCD Labor - Local Student Powered Labor<br>
              Morris County, New Jersey | ${dcdEmail}</p>
            </div>
          </div>
        </body>
        </html>
      `;
    } else if (type === 'quote-business') {
      // Quote business notification email
      const sampleQuoteData = {
        name: 'John Smith',
        email: 'john.smith@example.com',
        phone: '(555) 123-4567',
        address: '123 Main Street, Athens, GA 30601',
        services: ['Mulching', 'Brush removal', 'Log splitting'],
          notes: 'Please contact me in the morning. Updated preview.',
        leafHaul: true,
        submittedAt: new Date().toISOString()
      };
      const servicesList = sampleQuoteData.services.join(', ');
      const leafHaulText = sampleQuoteData.leafHaul ? ' (+ Leaf Haul Service $280)' : '';
      
      // Create HTML bullet list for services in preview
      const servicesHtml = sampleQuoteData.services.map(service => `<div style="margin: 8px 0; font-size: 16px; color: #374151;">• ${service}</div>`).join('');
      const leafHaulHtml = sampleQuoteData.leafHaul ? `<div style="margin: 8px 0; font-size: 16px; color: #374151;">• Leaf Haul Service ($280)</div>` : '';
      
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1f2937; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .booking-details { background: white; padding: 15px; margin: 15px 0; border-radius: 8px; }
            .detail-row { padding: 8px 0; border-bottom: 1px solid #eee; }
            .detail-label { font-weight: bold; min-width: 180px; display: inline-block; vertical-align: top; }
            .detail-value { display: inline-block; vertical-align: top; }
            .services-list { margin: 10px 0; }
            .service-item { padding: 5px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>New Quote Request</h1>
              <p>A customer has submitted a quote request</p>
            </div>
            
            <div class="content">
              <div class="booking-details">
                <h3>Customer Information</h3>
                
                <div class="detail-row">
                  <span class="detail-label">Name:</span>
                  <span class="detail-value">${sampleQuoteData.name}</span>
                </div>
                
                <div class="detail-row">
                  <span class="detail-label">Email:</span>
                  <span class="detail-value">${sampleQuoteData.email}</span>
                </div>
                
                <div class="detail-row">
                  <span class="detail-label">Phone:</span>
                  <span class="detail-value">${sampleQuoteData.phone}</span>
                </div>
                
                <div class="detail-row">
                  <span class="detail-label">Service Address:</span>
                  <span class="detail-value">${sampleQuoteData.address}</span>
                </div>
                
                <div class="services-list">
                  <div class="detail-row">
                    <span class="detail-label">Services Requested:</span>
                    <span class="detail-value">
                      ${sampleQuoteData.services.map(service => `<div class="service-item">• ${service}</div>`).join('')}
                      ${sampleQuoteData.leafHaul ? '<div class="service-item">• Leaf Haul Service (+$280)</div>' : ''}
                    </span>
                  </div>
                </div>
              </div>
              
              ${sampleQuoteData.notes ? `
              <div class="booking-details">
                <h3>Additional Notes</h3>
                <div class="detail-row">
                  <span class="detail-label">Notes:</span>
                  <span class="detail-value">${sampleQuoteData.notes}</span>
                </div>
              </div>
              ` : ''}
              
              <div class="booking-details">
                <div class="detail-row">
                  <span class="detail-label">Submitted:</span>
                  <span class="detail-value">${new Date(sampleQuoteData.submittedAt).toLocaleString()}</span>
                </div>
              </div>
            </div>
            
            <div class="footer">
              <p>DCD Labor - Local Student Powered Labor<br>
              This is an automated message from the DCD Labor website quote request form.</p>
            </div>
          </div>
        </body>
        </html>
      `;
    } else {
      htmlContent = await generateDCDEmailPreview(sampleBookingData, process.env.DCD_EMAIL);
    }

    res.setHeader('Content-Type', 'text/html');
    res.send(htmlContent);
  } catch (error) {
    console.error('❌ Error generating email preview:', error);
    res.status(500).json({ error: 'Failed to generate email preview' });
  }
});

// POST /api/send-review-email - Send Google review request email
app.post('/api/send-review-email', async (req, res) => {
  try {
    const { bookingData } = req.body;
    console.log('📧 POST /api/send-review-email - Sending review email for:', bookingData.customer?.name || 'unknown customer');
    
    if (!process.env.RESEND_API_KEY || !process.env.DCD_EMAIL) {
      return res.status(500).json({ error: 'Email configuration missing' });
    }

    // Send Google review email
    const reviewEmail = await sendGoogleReviewEmail(bookingData, process.env.RESEND_API_KEY, process.env.DCD_EMAIL);

    console.log('📧 Review email sent successfully');
    res.json({ 
      success: true, 
      message: 'Review email sent successfully',
      details: {
        reviewEmail: reviewEmail
      }
    });
  } catch (error) {
    console.error('❌ Error sending review email:', error);
    res.status(500).json({ error: 'Failed to send review email', details: error.message });
  }
});

async function generateCustomerEmailPreview(bookingData, dcdEmail) {
  const crewSizeLabels = {
    '2': '2-Man Crew',
    '3': '3-Man Crew',
    '4': '4-Man Crew'
  };

  const rateRange = await getRateRange(bookingData.service?.crewSize || bookingData.crewSize);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #22c55e; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .booking-details { background: white; padding: 15px; margin: 15px 0; border-radius: 8px; }
        .detail-row { padding: 8px 0; border-bottom: 1px solid #eee; }
        .detail-label { font-weight: bold; min-width: 180px; display: inline-block; vertical-align: top; }
        .detail-value { display: inline-block; vertical-align: top; }
        .services-list { margin: 10px 0; }
        .service-item { padding: 5px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>DCD Labor - Booking Confirmation</h1>
          <p>Thank you for choosing our landscaping services!</p>
        </div>
        
        <div class="content">
          <h2>Hello ${bookingData.customer?.name || bookingData.name},</h2>
          <p>We've received your booking request and will contact you within 24 hours to confirm your appointment. Your $80 deposit has been processed to secure your booking.</p>
          
          <div class="booking-details">
            <h3>Booking Details</h3>
            
            <div class="detail-row">
              <span class="detail-label">Name:</span>
              <span class="detail-value">${bookingData.customer?.name || bookingData.name}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Email:</span>
              <span class="detail-value">${bookingData.customer?.email || bookingData.email}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Phone:</span>
              <span class="detail-value">${bookingData.customer?.phone || bookingData.phone}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Service Address:</span>
              <span class="detail-value">${bookingData.service?.address || bookingData.customer?.address || bookingData.address || 'Not specified'}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Preferred Date:</span>
              <span class="detail-value">${new Date(bookingData.service?.date || bookingData.date).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Crew Size:</span>
              <span class="detail-value">${crewSizeLabels[bookingData.service?.crewSize || bookingData.crewSize] || bookingData.service?.crewSize || bookingData.crewSize}</span>
            </div>
            
            
            ${(bookingData.services && bookingData.services.length > 0) ? `
            <div class="services-list">
              <div class="detail-label">Services Requested: </div>
              ${bookingData.services.map(service => `<div class="service-item">• ${service}</div>`).join('')}
            </div>
            ` : ''}
            
            ${(bookingData.displayTime || bookingData.service?.displayTime) ? `
            <div class="detail-row">
              <span class="detail-label">Scheduled Time:</span>
              <span class="detail-value">${bookingData.displayTime || bookingData.service?.displayTime}</span>
            </div>
            ` : ''}

            <div class="detail-row">
              <span class="detail-label">Rate:</span>
              <span class="detail-value">${rateRange}</span>
            </div>
            
            ${(bookingData.notes || bookingData.service?.description) ? `
            <div class="detail-row">
              <span class="detail-label">Additional Notes:</span>
              <span class="detail-value">${bookingData.notes || bookingData.service?.description}</span>
            </div>
            ` : ''}
          </div>
          
          <h3>What's Next?</h3>
          <ul>
            <li>We'll text you within 24 hours to confirm your appointment</li>
            <li>Your $80 deposit has been processed to secure your booking</li>
            <li>Final payment is due upon completion of services</li>
          </ul>
          
          <p>If you have any questions or need to make changes to your booking, please contact us at:</p>
          <p><strong>Email:</strong> ${dcdEmail}<br>
          <strong>Phone:</strong> (908) 285-4587</p>
          
          <p>Thank you for choosing DCD Labor!</p>
        </div>
        
        <div class="footer">
          <p>DCD Labor - Professional Landscaping Services<br>
          Athens, GA | ${dcdEmail}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

async function generateDCDEmailPreview(bookingData, dcdEmail) {
  const crewSizeLabels = {
    '2': '2-Man Crew',
    '3': '3-Man Crew',
    '4': '4-Man Crew'
  };

  const rateRange = await getRateRange(bookingData.service?.crewSize || bookingData.crewSize);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1f2937; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .booking-details { background: white; padding: 15px; margin: 15px 0; border-radius: 8px; }
        .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .detail-label { font-weight: bold; }
        .services-list { margin: 10px 0; }
        .service-item { padding: 5px 0; }
        .urgent { background: #fee2e2; border: 1px solid #ef4444; padding: 15px; margin: 15px 0; border-radius: 8px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔔 New Booking Request</h1>
          <p>A new customer has submitted a booking request</p>
        </div>
        
        <div class="content">
          <div class="urgent">
            <strong>⚠️ Action Required:</strong> Contact customer within 24 hours to confirm appointment.
          </div>
          
          <div class="booking-details">
            <h3>Customer Information</h3>
            
            <div class="detail-row">
              <span class="detail-label">Name:</span>
              <span class="detail-value">${bookingData.customer?.name || bookingData.name}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Email: </span>
              <span><a href="mailto:${bookingData.customer?.email || bookingData.email}">${bookingData.customer?.email || bookingData.email}</a></span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Phone: </span>
              <span><a href="tel:${bookingData.customer?.phone || bookingData.phone}">${bookingData.customer?.phone || bookingData.phone}</a></span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Service Address:</span>
              <span class="detail-value">${bookingData.service?.address || bookingData.customer?.address || bookingData.address || 'Not specified'}</span>
            </div>
          </div>
          
          <div class="booking-details">
            <h3>Service Details</h3>
            
            <div class="detail-row">
              <span class="detail-label">Preferred Date:</span>
              <span class="detail-value">${new Date(bookingData.service?.date || bookingData.date).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Crew Size:</span>
              <span class="detail-value">${crewSizeLabels[bookingData.service?.crewSize || bookingData.crewSize] || bookingData.service?.crewSize || bookingData.crewSize}</span>
            </div>
            
            
            ${(bookingData.services && bookingData.services.length > 0) ? `
            <div class="services-list">
              <div class="detail-label">Services Requested: </div>
              ${bookingData.services.map(service => `<div class="service-item">• ${service}</div>`).join('')}
            </div>
            ` : ''}
            
            ${(bookingData.displayTime || bookingData.service?.displayTime) ? `
            <div class="detail-row">
              <span class="detail-label">Scheduled Time:</span>
              <span class="detail-value">${bookingData.displayTime || bookingData.service?.displayTime}</span>
            </div>
            ` : ''}

            <div class="detail-row">
              <span class="detail-label">Rate:</span>
              <span class="detail-value">${rateRange}</span>
            </div>
            
            ${(bookingData.notes || bookingData.service?.description) ? `
            <div class="detail-row">
              <span class="detail-label">Additional Notes:</span>
              <span class="detail-value">${bookingData.notes || bookingData.service?.description}</span>
            </div>
            ` : ''}
          </div>
          
          <div class="booking-details">
            <h3>Next Steps</h3>
            <ul>
              <li>Contact customer at <a href="tel:${bookingData.customer?.phone || bookingData.phone}">${bookingData.customer?.phone || bookingData.phone}</a> to confirm booking time</li>
              <li>Confirm availability for ${new Date(bookingData.service?.date || bookingData.date).toLocaleDateString()}</li>
              <li>Schedule crew</li>
            </ul>
          </div>
          
          <p><strong>Booking submitted at:</strong> ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="footer">
          <p>DCD Labor Admin System<br>
          This email was automatically generated from your booking system.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Helper function to get rate range based on crew size from database
async function getRateRange(crewSize) {
  try {
    console.log('💰 getRateRange called with:', { crewSize, type: typeof crewSize });
    
    // Ensure database connection
    if (!db) {
      await connectToMongo();
    }
    const collection = db.collection('team_rates');
    const ratesDoc = await collection.findOne({});
    
    console.log('💰 Rates from database:', ratesDoc);
    
    if (ratesDoc) {
      // Map numeric crew size to database key format
      const crewSizeMapping = {
        '2': 'twoMan',
        '3': 'threeMan', 
        '4': 'fourMan'
      };
      
      const dbKey = crewSizeMapping[crewSize?.toString()];
      const rate = ratesDoc[dbKey];
      
      console.log('💰 Rate lookup:', { 
        crewSize, 
        crewSizeString: crewSize?.toString(), 
        dbKey, 
        rate 
      });
      
      if (rate) {
        return `$${rate}/hour`;
      }
    }
    
    // Fallback to default rates if not found in database
    const defaultRates = {
      '2': 70,
      '3': 100,
      '4': 130
    };
    
    const rate = defaultRates[crewSize?.toString()];
    if (rate) {
      return `$${rate}/hour`;
    }
    
    return 'Contact for pricing';
  } catch (error) {
    console.error('Error fetching rates:', error);
    return 'Contact for pricing';
  }
}

async function sendCustomerConfirmation(bookingData, apiKey, dcdEmail) {
  const crewSizeLabels = {
    '2': '2-Man Crew',
    '3': '3-Man Crew',
    '4': '4-Man Crew'
  };

  const rateRange = await getRateRange(bookingData.service?.crewSize || bookingData.crewSize);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #22c55e; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .booking-details { background: white; padding: 15px; margin: 15px 0; border-radius: 8px; }
        .detail-row { padding: 8px 0; border-bottom: 1px solid #eee; }
        .detail-label { font-weight: bold; min-width: 180px; display: inline-block; vertical-align: top; }
        .detail-value { display: inline-block; vertical-align: top; }
        .services-list { margin: 10px 0; }
        .service-item { padding: 5px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>DCD Labor - Booking Confirmation</h1>
          <p>Thank you for choosing our landscaping services!</p>
        </div>
        
        <div class="content">
          <h2>Hello ${bookingData.customer?.name || bookingData.name},</h2>
          <p>We've received your booking request and will contact you within 24 hours to confirm your appointment. Your $80 deposit has been processed to secure your booking.</p>
          
          <div class="booking-details">
            <h3>Booking Details</h3>
            
            <div class="detail-row">
              <span class="detail-label">Name:</span>
              <span class="detail-value">${bookingData.customer?.name || bookingData.name}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Email:</span>
              <span class="detail-value">${bookingData.customer?.email || bookingData.email}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Phone:</span>
              <span class="detail-value">${bookingData.customer?.phone || bookingData.phone}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Service Address:</span>
              <span class="detail-value">${bookingData.service?.address || bookingData.customer?.address || bookingData.address || 'Not specified'}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Preferred Date:</span>
              <span class="detail-value">${new Date(bookingData.service?.date || bookingData.date).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Crew Size:</span>
              <span class="detail-value">${crewSizeLabels[bookingData.service?.crewSize || bookingData.crewSize] || bookingData.service?.crewSize || bookingData.crewSize}</span>
            </div>
            
            
            ${(bookingData.services && bookingData.services.length > 0) ? `
            <div class="services-list">
              <div class="detail-label">Services Requested: </div>
              ${bookingData.services.map(service => `<div class="service-item">• ${service}</div>`).join('')}
            </div>
            ` : ''}
            
            ${(bookingData.displayTime || bookingData.service?.displayTime) ? `
            <div class="detail-row">
              <span class="detail-label">Scheduled Time:</span>
              <span class="detail-value">${bookingData.displayTime || bookingData.service?.displayTime}</span>
            </div>
            ` : ''}

            <div class="detail-row">
              <span class="detail-label">Rate:</span>
              <span class="detail-value">${rateRange}</span>
            </div>
            
            ${(bookingData.notes || bookingData.service?.description) ? `
            <div class="detail-row">
              <span class="detail-label">Additional Notes:</span>
              <span class="detail-value">${bookingData.notes || bookingData.service?.description}</span>
            </div>
            ` : ''}
          </div>
          
          <h3>What's Next?</h3>
          <ul>
            <li>We'll text you within 24 hours to confirm your appointment</li>
            <li>Your $80 deposit has been processed to secure your booking</li>
            <li>Final payment is due upon completion of services</li>
          </ul>
          
          <p>If you have any questions or need to make changes to your booking, please contact us at:</p>
          <p><strong>Email:</strong> ${dcdEmail}<br>
          <strong>Phone:</strong> (908) 285-4587</p>
          
          <p>Thank you for choosing DCD Labor!</p>
        </div>
        
        <div class="footer">
          <p>DCD Labor - Professional Landscaping Services<br>
          Athens, GA | ${dcdEmail}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const emailConfig = getEmailConfig();
  
  const emailData = {
    from: emailConfig.customerFrom,
    to: emailConfig.sendToCustomer ? [bookingData.customer?.email || bookingData.email] : [dcdEmail],
    subject: emailConfig.sendToCustomer ? 'Booking Confirmation - DCD Labor Services' : 'Customer Booking Confirmation - DCD Labor Services (Testing)',
    html: htmlContent
  };

  return await sendEmailViaResend(emailData, apiKey);
}

async function sendDCDNotification(bookingData, apiKey, dcdEmail) {
  const crewSizeLabels = {
    '2': '2-Man Crew',
    '3': '3-Man Crew',
    '4': '4-Man Crew'
  };

  const rateRange = await getRateRange(bookingData.service?.crewSize || bookingData.crewSize);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1f2937; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .booking-details { background: white; padding: 15px; margin: 15px 0; border-radius: 8px; }
        .detail-row { padding: 8px 0; border-bottom: 1px solid #eee; }
        .detail-label { font-weight: bold; min-width: 180px; display: inline-block; vertical-align: top; }
        .detail-value { display: inline-block; vertical-align: top; }
        .services-list { margin: 10px 0; }
        .service-item { padding: 5px 0; }
        .urgent { background: #fee2e2; border: 1px solid #ef4444; padding: 15px; margin: 15px 0; border-radius: 8px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔔 New Booking Request</h1>
          <p>A new customer has submitted a booking request</p>
        </div>
        
        <div class="content">
          <div class="urgent">
            <strong>⚠️ Action Required:</strong> Contact customer within 24 hours to confirm appointment.
          </div>
          
          <div class="booking-details">
            <h3>Customer Information</h3>
            
            <div class="detail-row">
              <span class="detail-label">Name:</span>
              <span class="detail-value">${bookingData.customer?.name || bookingData.name}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Email: </span>
              <span><a href="mailto:${bookingData.customer?.email || bookingData.email}">${bookingData.customer?.email || bookingData.email}</a></span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Phone: </span>
              <span><a href="tel:${bookingData.customer?.phone || bookingData.phone}">${bookingData.customer?.phone || bookingData.phone}</a></span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Service Address:</span>
              <span class="detail-value">${bookingData.service?.address || bookingData.customer?.address || bookingData.address || 'Not specified'}</span>
            </div>
          </div>
          
          <div class="booking-details">
            <h3>Service Details</h3>
            
            <div class="detail-row">
              <span class="detail-label">Preferred Date:</span>
              <span class="detail-value">${new Date(bookingData.service?.date || bookingData.date).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Crew Size:</span>
              <span class="detail-value">${crewSizeLabels[bookingData.service?.crewSize || bookingData.crewSize] || bookingData.service?.crewSize || bookingData.crewSize}</span>
            </div>
            
            
            ${(bookingData.services && bookingData.services.length > 0) ? `
            <div class="services-list">
              <div class="detail-label">Services Requested: </div>
              ${bookingData.services.map(service => `<div class="service-item">• ${service}</div>`).join('')}
            </div>
            ` : ''}
            
            ${(bookingData.displayTime || bookingData.service?.displayTime) ? `
            <div class="detail-row">
              <span class="detail-label">Scheduled Time:</span>
              <span class="detail-value">${bookingData.displayTime || bookingData.service?.displayTime}</span>
            </div>
            ` : ''}

            <div class="detail-row">
              <span class="detail-label">Rate:</span>
              <span class="detail-value">${rateRange}</span>
            </div>
            
            ${(bookingData.notes || bookingData.service?.description) ? `
            <div class="detail-row">
              <span class="detail-label">Additional Notes:</span>
              <span class="detail-value">${bookingData.notes || bookingData.service?.description}</span>
            </div>
            ` : ''}
          </div>
          
          <div class="booking-details">
            <h3>Next Steps</h3>
            <ul>
              <li>Contact customer at <a href="tel:${bookingData.customer?.phone || bookingData.phone}">${bookingData.customer?.phone || bookingData.phone}</a> to confirm booking time</li>
              <li>Confirm availability for ${new Date(bookingData.service?.date || bookingData.date).toLocaleDateString()}</li>
              <li>Schedule crew</li>
            </ul>
          </div>
          
          <p><strong>Booking submitted at:</strong> ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="footer">
          <p>DCD Labor Admin System<br>
          This email was automatically generated from your booking system.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const emailConfig = getEmailConfig();
  
  const emailData = {
    from: emailConfig.adminFrom,
    to: [dcdEmail],
    subject: `🔔 New Booking Request - ${bookingData.customer?.name || bookingData.name} (${new Date(bookingData.service?.date || bookingData.date).toLocaleDateString()})`,
    html: htmlContent
  };

  return await sendEmailViaResend(emailData, apiKey);
}

async function sendEmailViaResend(emailData, apiKey) {
  try {
    console.log('📧 Sending email with Resend API...');
    console.log('📧 Email data:', { from: emailData.from, to: emailData.to, subject: emailData.subject });
    
    const response = await resend.emails.send(emailData);
    
    console.log('📧 Resend API response:', response);
    
    if (response.error) {
      console.error('❌ Resend API error:', response.error);
      throw new Error(`Resend API error: ${JSON.stringify(response.error)}`);
    }
    
    return response.data;
  } catch (error) {
    console.error('❌ Error in sendEmailViaResend:', error);
    throw error;
  }
}

async function sendGoogleReviewEmail(bookingData, apiKey, dcdEmail) {
  const googleReviewUrl = "https://www.google.com/search?client=safari&sca_esv=c66ebe7918868edf&hl=en-us&q=dcdlabor.com+reviews&uds=AOm0WdEWLxsquUV4gxq7J1YSuvZiRdrTmX4_AU1giwU9g4ziDuRvlknMyw8gsZPSPmLgpACwT5a4DcPJolTo4Z-UodEeEr4lmt3mvF-9VGTFndsNmBDV_jzkyfXJwR_Ac73161-qrPI8dF2pgd5bneMJQVOwSeT2rfmn8mpmH5teNz-AIbl2eAhdkzjEERf7Hle3C1C9T0E4gqS4eIBWXZ8Eip3TTianQ18WEYhJu41HT0AwvWYbVlppKgPlPX0IsukInEd0HmPWlgXrM6JChy19L0xVBnlr72FrbQO6cSa7543CzG8pJLovROxq-d5EtpCNe3TSn0chG0qJVeuy4D68pIRpqnBNCD7Gty_wIvYnNQmsfQuzbq7yBCcYvTYiPy5sFSYBIo24egV1FhFDuLT6oPiP18VlUt2-G7jP76wX697Ul09hF0yKt86JDnrh2Aj_pK4PcT0S&si=AMgyJEtREmoPL4P1I5IDCfuA8gybfVI2d5Uj7QMwYCZHKDZ-E8Oh7e7S7KVYGDmINkdwDdU_8oWTBGghNCf07GL5t-9Z6w3ejGMuHEhZkASO--6r0p0kBn9s7kw4rctZXkUBwPzX_SWA&sa=X&ved=2ahUKEwjm-5er2LKOAxXuLVkFHTkACJIQk8gLegQIGxAB&ictx=1&stq=1&cs=1&lei=c-dvaKb2De7b5NoPuYCgkAk#ebo=4";
  const websiteUrl = "https://dcdlabor.com";
  
  // Get pricing information
  const crewSizeLabels = {
    '2': '2-Man Crew',
    '3': '3-Man Crew', 
    '4': '4-Man Crew'
  };
  const rateRange = await getRateRange(bookingData.service?.crewSize || bookingData.crewSize);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 12px 12px 0 0; }
        .content { padding: 30px 20px; background: #f8fffe; border: 1px solid #e5e7eb; }
        .thank-you-section { background: white; padding: 25px; margin: 20px 0; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .review-section { background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 25px; margin: 20px 0; border-radius: 12px; border: 2px solid #f59e0b; text-align: center; }
        .review-button { display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; margin: 15px 0; transition: transform 0.2s ease; }
        .review-button:hover { transform: translateY(-2px); text-decoration: none; color: white; }
        .website-section { background: white; padding: 25px; margin: 20px 0; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center; }
        .website-button { display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 10px 0; }
        .website-button:hover { text-decoration: none; color: white; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; background: #f3f4f6; border-radius: 0 0 12px 12px; }
        .star-rating { color: #f59e0b; font-size: 24px; margin: 10px 0; }
        .highlight { color: #f59e0b; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Thank You for Choosing DCD Labor!</h1>
          <p>Your landscaping service has been completed</p>
        </div>
        
        <div class="content">
          <div class="thank-you-section">
            <h2>Hello ${bookingData.customer?.name || bookingData.name}!</h2>
            <p>We hope you're absolutely <span class="highlight">thrilled</span> with the landscaping work we completed at your property. Your satisfaction is our top priority, and we truly appreciate the opportunity to serve you.</p>
            <p>At DCD Labor, we take great pride in transforming outdoor spaces and delivering exceptional results for every client.</p>
          </div>

          <div class="thank-you-section">
            <h3>📋 Service Summary</h3>
            <div style="padding: 15px 0;">
              <div style="margin: 8px 0;"><strong>Service Date:</strong> ${bookingData.service?.date ? new Date(bookingData.service.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}</div>
              <div style="margin: 8px 0;"><strong>Crew Size:</strong> ${crewSizeLabels[bookingData.service?.crewSize || bookingData.crewSize] || bookingData.service?.crewSize || bookingData.crewSize || 'N/A'}</div>
              ${bookingData.service?.address ? `<div style="margin: 8px 0;"><strong>Service Address:</strong> ${bookingData.service.address}</div>` : ''}
              ${bookingData.services && bookingData.services.length > 0 ? `<div style="margin: 8px 0;"><strong>Services Completed:</strong><br>${bookingData.services.map(service => `&nbsp;&nbsp;• ${service}`).join('<br>')}</div>` : ''}
              
              ${bookingData.finalPaymentDetails ? `
              <div style="margin: 16px 0; padding: 12px; background: #f8f9fa; border-radius: 6px; border-left: 4px solid #22c55e;">
                <h4 style="margin: 0 0 8px 0; color: #16a34a;">💰 Final Payment Breakdown</h4>
                <div style="margin: 4px 0;"><strong>Materials Cost:</strong> $${bookingData.finalPaymentDetails.materialsCost.toFixed(2)}</div>
                <div style="margin: 4px 0;"><strong>Labor:</strong> ${bookingData.finalPaymentDetails.serviceHours} hours × $${bookingData.finalPaymentDetails.crewRate}/hr = $${bookingData.finalPaymentDetails.laborCost.toFixed(2)}</div>
                <div style="margin: 4px 0; border-top: 1px solid #e5e7eb; padding-top: 4px;"><strong>Subtotal:</strong> $${bookingData.finalPaymentDetails.subtotal.toFixed(2)}</div>
                <div style="margin: 4px 0;"><strong>Deposit Paid:</strong> -$${bookingData.finalPaymentDetails.deposit.toFixed(2)}</div>
                <div style="margin: 4px 0;"><strong>Final Payment:</strong> $${bookingData.finalPaymentDetails.finalAmount.toFixed(2)}</div>
                <div style="margin: 8px 0; padding-top: 8px; border-top: 2px solid #22c55e; font-size: 16px;"><strong>Total Service Cost: $${bookingData.finalPaymentDetails.totalPaid.toFixed(2)}</strong></div>
              </div>
              ` : `<div style="margin: 8px 0;"><strong>Service Rate:</strong> ${rateRange}</div>`}
            </div>
          </div>

          <div class="review-section">
            <h3>🌟 Love Your Results? Share Your Experience!</h3>
            <div class="star-rating">⭐⭐⭐⭐⭐</div>
            <p>If we did a great job and you're happy with our work, we'd be incredibly grateful if you could take a moment to leave us a <strong>Google review</strong>.</p>
            <p>Your feedback helps other homeowners discover our services and motivates our team to continue delivering outstanding results!</p>
            
            <a href="${googleReviewUrl}" class="review-button" target="_blank">
              🌟 Leave a Google Review
            </a>
            
            <p><small>Click the button above to share your experience on Google Reviews</small></p>
          </div>

          <div class="website-section">
            <h3>🏡 Need More Landscaping Services?</h3>
            <p>We're here whenever you need us! Whether it's seasonal maintenance, additional landscaping projects, or emergency cleanup, DCD Labor is ready to help.</p>
            
            <a href="${websiteUrl}" class="website-button" target="_blank">
              Book Your Next Service
            </a>
            
            <p><strong>Recommend us to friends and neighbors!</strong> Word-of-mouth referrals are the best compliment we can receive.</p>
          </div>

          <div class="thank-you-section">
            <h3>📞 Stay Connected</h3>
            <p>Have questions or need to schedule another service?</p>
            <p>
              <strong>Email:</strong> ${dcdEmail}<br>
              <strong>Phone:</strong> (908) 285-4587<br>
              <strong>Website:</strong> <a href="${websiteUrl}" target="_blank">dcdlabor.com</a>
            </p>
          </div>
        </div>
        
        <div class="footer">
          <p>Thank you for being an amazing customer! 🌟</p>
          <p><strong>DCD Labor - Your Premier Landscaping Partner</strong></p>
          <p><small>This email was sent because you recently completed a service with DCD Labor.</small></p>
        </div>
      </div>
    </body>
    </html>
  `;

  const emailConfig = getEmailConfig();
  
  const emailData = {
    from: emailConfig.customerFrom,
    to: emailConfig.sendToCustomer ? [bookingData.customer?.email || bookingData.email] : [dcdEmail],
    subject: emailConfig.sendToCustomer ? "🌟 Thank you for choosing DCD Labor - Share your experience!" : "Review Email for Customer - DCD Labor (Testing)",
    html: htmlContent
  };

  console.log('📧 Review email will be sent to:', emailData.to);
  console.log('📧 Review email sendToCustomer setting:', emailConfig.sendToCustomer);
  console.log('📧 Review email customer email:', bookingData.customer?.email || bookingData.email);
  
  const result = await sendEmailViaResend(emailData, apiKey);
  console.log('📧 Review email sent successfully to:', emailData.to);
  
  return result;
}

async function generateGoogleReviewEmailPreview(bookingData, dcdEmail) {
  const googleReviewUrl = "https://www.google.com/search?client=safari&sca_esv=c66ebe7918868edf&hl=en-us&q=dcdlabor.com+reviews&uds=AOm0WdEWLxsquUV4gxq7J1YSuvZiRdrTmX4_AU1giwU9g4ziDuRvlknMyw8gsZPSPmLgpACwT5a4DcPJolTo4Z-UodEeEr4lmt3mvF-9VGTFndsNmBDV_jzkyfXJwR_Ac73161-qrPI8dF2pgd5bneMJQVOwSeT2rfmn8mpmH5teNz-AIbl2eAhdkzjEERf7Hle3C1C9T0E4gqS4eIBWXZ8Eip3TTianQ18WEYhJu41HT0AwvWYbVlppKgPlPX0IsukInEd0HmPWlgXrM6JChy19L0xVBnlr72FrbQO6cSa7543CzG8pJLovROxq-d5EtpCNe3TSn0chG0qJVeuy4D68pIRpqnBNCD7Gty_wIvYnNQmsfQuzbq7yBCcYvTYiPy5sFSYBIo24egV1FhFDuLT6oPiP18VlUt2-G7jP76wX697Ul09hF0yKt86JDnrh2Aj_pK4PcT0S&si=AMgyJEtREmoPL4P1I5IDCfuA8gybfVI2d5Uj7QMwYCZHKDZ-E8Oh7e7S7KVYGDmINkdwDdU_8oWTBGghNCf07GL5t-9Z6w3ejGMuHEhZkASO--6r0p0kBn9s7kw4rctZXkUBwPzX_SWA&sa=X&ved=2ahUKEwjm-5er2LKOAxXuLVkFHTkACJIQk8gLegQIGxAB&ictx=1&stq=1&cs=1&lei=c-dvaKb2De7b5NoPuYCgkAk#ebo=4";
  const websiteUrl = "https://dcdlabor.com";
  
  // Get pricing information
  const crewSizeLabels = {
    '2': '2-Man Crew',
    '3': '3-Man Crew', 
    '4': '4-Man Crew'
  };
  const rateRange = await getRateRange(bookingData.service?.crewSize || bookingData.crewSize);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 12px 12px 0 0; }
        .content { padding: 30px 20px; background: #f8fffe; border: 1px solid #e5e7eb; }
        .thank-you-section { background: white; padding: 25px; margin: 20px 0; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .review-section { background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 25px; margin: 20px 0; border-radius: 12px; border: 2px solid #f59e0b; text-align: center; }
        .review-button { display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; margin: 15px 0; transition: transform 0.2s ease; }
        .review-button:hover { transform: translateY(-2px); text-decoration: none; color: white; }
        .website-section { background: white; padding: 25px; margin: 20px 0; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center; }
        .website-button { display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 10px 0; }
        .website-button:hover { text-decoration: none; color: white; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; background: #f3f4f6; border-radius: 0 0 12px 12px; }
        .star-rating { color: #f59e0b; font-size: 24px; margin: 10px 0; }
        .highlight { color: #f59e0b; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Thank You for Choosing DCD Labor!</h1>
          <p>Your landscaping service has been completed</p>
        </div>
        
        <div class="content">
          <div class="thank-you-section">
            <h2>Hello ${bookingData.customer?.name || bookingData.name}!</h2>
            <p>We hope you're absolutely <span class="highlight">thrilled</span> with the landscaping work we completed at your property. Your satisfaction is our top priority, and we truly appreciate the opportunity to serve you.</p>
            <p>At DCD Labor, we take great pride in transforming outdoor spaces and delivering exceptional results for every client.</p>
          </div>

          <div class="thank-you-section">
            <h3>📋 Service Summary</h3>
            <div style="padding: 15px 0;">
              <div style="margin: 8px 0;"><strong>Service Date:</strong> ${bookingData.service?.date ? new Date(bookingData.service.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}</div>
              <div style="margin: 8px 0;"><strong>Crew Size:</strong> ${crewSizeLabels[bookingData.service?.crewSize || bookingData.crewSize] || bookingData.service?.crewSize || bookingData.crewSize || 'N/A'}</div>
              ${bookingData.service?.address ? `<div style="margin: 8px 0;"><strong>Service Address:</strong> ${bookingData.service.address}</div>` : ''}
              ${bookingData.services && bookingData.services.length > 0 ? `<div style="margin: 8px 0;"><strong>Services Completed:</strong><br>${bookingData.services.map(service => `&nbsp;&nbsp;• ${service}`).join('<br>')}</div>` : ''}
              
              ${bookingData.finalPaymentDetails ? `
              <div style="margin: 16px 0; padding: 12px; background: #f8f9fa; border-radius: 6px; border-left: 4px solid #22c55e;">
                <h4 style="margin: 0 0 8px 0; color: #16a34a;">💰 Final Payment Breakdown</h4>
                <div style="margin: 4px 0;"><strong>Materials Cost:</strong> $${bookingData.finalPaymentDetails.materialsCost.toFixed(2)}</div>
                <div style="margin: 4px 0;"><strong>Labor:</strong> ${bookingData.finalPaymentDetails.serviceHours} hours × $${bookingData.finalPaymentDetails.crewRate}/hr = $${bookingData.finalPaymentDetails.laborCost.toFixed(2)}</div>
                <div style="margin: 4px 0; border-top: 1px solid #e5e7eb; padding-top: 4px;"><strong>Subtotal:</strong> $${bookingData.finalPaymentDetails.subtotal.toFixed(2)}</div>
                <div style="margin: 4px 0;"><strong>Deposit Paid:</strong> -$${bookingData.finalPaymentDetails.deposit.toFixed(2)}</div>
                <div style="margin: 4px 0;"><strong>Final Payment:</strong> $${bookingData.finalPaymentDetails.finalAmount.toFixed(2)}</div>
                <div style="margin: 8px 0; padding-top: 8px; border-top: 2px solid #22c55e; font-size: 16px;"><strong>Total Service Cost: $${bookingData.finalPaymentDetails.totalPaid.toFixed(2)}</strong></div>
              </div>
              ` : `<div style="margin: 8px 0;"><strong>Service Rate:</strong> ${rateRange}</div>`}
            </div>
          </div>

          <div class="review-section">
            <h3>🌟 Love Your Results? Share Your Experience!</h3>
            <div class="star-rating">⭐⭐⭐⭐⭐</div>
            <p>If we did a great job and you're happy with our work, we'd be incredibly grateful if you could take a moment to leave us a <strong>Google review</strong>.</p>
            <p>Your feedback helps other homeowners discover our services and motivates our team to continue delivering outstanding results!</p>
            
            <a href="${googleReviewUrl}" class="review-button" target="_blank">
              🌟 Leave a Google Review
            </a>
            
            <p><small>Click the button above to share your experience on Google Reviews</small></p>
          </div>

          <div class="website-section">
            <h3>🏡 Need More Landscaping Services?</h3>
            <p>We're here whenever you need us! Whether it's seasonal maintenance, additional landscaping projects, or emergency cleanup, DCD Labor is ready to help.</p>
            
            <a href="${websiteUrl}" class="website-button" target="_blank">
              Book Your Next Service
            </a>
            
            <p><strong>Recommend us to friends and neighbors!</strong> Word-of-mouth referrals are the best compliment we can receive.</p>
          </div>

          <div class="thank-you-section">
            <h3>📞 Stay Connected</h3>
            <p>Have questions or need to schedule another service?</p>
            <p>
              <strong>Email:</strong> ${dcdEmail}<br>
              <strong>Phone:</strong> (908) 285-4587<br>
              <strong>Website:</strong> <a href="${websiteUrl}" target="_blank">dcdlabor.com</a>
            </p>
          </div>
        </div>
        
        <div class="footer">
          <p>Thank you for being an amazing customer! 🌟</p>
          <p><strong>DCD Labor - Your Premier Landscaping Partner</strong></p>
          <p><small>This email was sent because you recently completed a service with DCD Labor.</small></p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// SQUARE PAYMENT ENDPOINTS

// POST /api/square/create-payment - Create payment with Square
app.post('/api/square/create-payment', async (req, res) => {
  try {
    const { sourceId, cardTokenForSaving, amount, currency = 'USD', description, customerInfo, saveCard, locationId } = req.body;
    console.log('💳 POST /api/square/create-payment - Amount:', amount, 'Description:', description);

    if (!squareConfig.accessToken) {
      console.log('💳 Debug - Square access token not configured');
      return res.status(500).json({ error: 'Payment system not configured' });
    }

    if (!amount || amount < 100) { // Minimum $1.00 in cents
      return res.status(400).json({ error: 'Invalid payment amount' });
    }

    let customerId = null;
    let cardToken = null;

    // Create or find customer if saving card
    if (saveCard && customerInfo) {
      try {
        // Clean up phone number - remove formatting and keep only digits
        let cleanPhone = customerInfo.phone?.replace(/\D/g, '') || '';
        
        // Add +1 country code if needed (Square expects E.164 format)
        if (cleanPhone.length === 10) {
          cleanPhone = '+1' + cleanPhone;
        } else if (cleanPhone.length === 11 && cleanPhone.startsWith('1')) {
          cleanPhone = '+' + cleanPhone;
        }
        
        // Try to create customer
        const createCustomerRequest = {
          given_name: customerInfo.name?.split(' ')[0] || '',
          family_name: customerInfo.name?.split(' ').slice(1).join(' ') || '',
          email_address: customerInfo.email
        };
        
        // Only include phone if we have a valid format
        if (cleanPhone.match(/^\+1\d{10}$/)) {
          createCustomerRequest.phone_number = cleanPhone;
          console.log('💳🔍 Using formatted phone:', cleanPhone);
        } else {
          console.log('💳🔍 Skipping invalid phone format:', customerInfo.phone);
        }

        console.log('💳🔍 Creating Square customer:', createCustomerRequest);
        const customerResponse = await makeSquareRequest('/customers', 'POST', createCustomerRequest);
        
        if (customerResponse.customer) {
          customerId = customerResponse.customer.id;
          console.log('💳✅ Created Square customer:', customerId);
        }
      } catch (customerError) {
        console.log('💳⚠️ Customer creation failed, trying to find existing customer by email...');
        console.log('💳⚠️ Original error:', customerError.message);
        
        // Try to search for existing customer by email
        try {
          const searchResponse = await makeSquareRequest('/customers/search', 'POST', {
            query: {
              filter: {
                email_address: {
                  exact: customerInfo.email
                }
              }
            }
          });
          
          if (searchResponse.customers && searchResponse.customers.length > 0) {
            customerId = searchResponse.customers[0].id;
            console.log('💳✅ Found existing Square customer:', customerId);
          } else {
            console.log('💳⚠️ No existing customer found, will process payment without card saving');
          }
        } catch (searchError) {
          console.log('💳⚠️ Customer search also failed:', searchError.message);
          console.log('💳⚠️ Will process payment without card saving');
        }
      }
    }

    // Create payment with direct HTTP request
    const paymentRequest = {
      source_id: sourceId,
      idempotency_key: randomUUID(),
      amount_money: {
        amount: parseInt(amount),
        currency: currency
      },
      location_id: locationId || squareConfig.locationId,
      note: description,
      autocomplete: true
    };

    // Add customer ID if we have one
    if (customerId) {
      paymentRequest.customer_id = customerId;
    }

    console.log('💳🔍 Payment request:', JSON.stringify(paymentRequest, null, 2));

    const paymentResponse = await makeSquareRequest('/payments', 'POST', paymentRequest);
    
    if (paymentResponse.payment) {
      const payment = paymentResponse.payment;
      console.log('💳✅ Created Square payment:', payment.id);

      // Save card using separate token if provided
      if (saveCard && customerId && cardTokenForSaving) {
        console.log('💳🔍 Starting card saving process with separate token...');
        console.log('💳🔍 Customer ID:', customerId);
        console.log('💳🔍 Card saving token:', cardTokenForSaving);
        
        try {
          const createCardRequest = {
            source_id: cardTokenForSaving,
            idempotency_key: randomUUID(),
            card: {
              customer_id: customerId
            }
          };
          
          console.log('💳🔍 Creating card with separate token...');
          const cardResponse = await makeSquareRequest('/cards', 'POST', createCardRequest);
          
          if (cardResponse.card) {
            cardToken = cardResponse.card.id;
            console.log('💳✅ Successfully saved card with separate token!');
            console.log('💳✅ Card ID:', cardToken);
            console.log('💳✅ Card last 4:', cardResponse.card.last_4);
            console.log('💳✅ Card brand:', cardResponse.card.card_brand);
          } else {
            console.log('💳❌ Card saving failed - no card in response');
            cardToken = null;
          }
        } catch (cardError) {
          console.error('💳❌ Failed to save card with separate token:', cardError.message);
          if (cardError.squareErrors) {
            console.error('💳❌ Square API errors:', JSON.stringify(cardError.squareErrors, null, 2));
          }
          cardToken = null;
          // Don't fail the payment, just log the card saving failure
        }
      } else {
        console.log('💳🔍 Skipping card saving:', {
          saveCard: saveCard,
          customerId: !!customerId,
          hasCardToken: !!cardTokenForSaving
        });
        cardToken = null;
      }

      res.json({
        success: true,
        payment: {
          id: payment.id,
          status: payment.status,
          amount_money: payment.amount_money,
          created_at: payment.created_at
        },
        customerId,
        cardToken
      });
    } else {
      throw new Error('Payment creation failed');
    }
  } catch (error) {
    console.error('❌ Error creating Square payment:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error details:', JSON.stringify(error, null, 2));
    
    let errorMessage = 'Payment processing failed';
    if (error.errors && error.errors.length > 0) {
      errorMessage = error.errors[0].detail || errorMessage;
      console.error('❌ Square API errors:', error.errors);
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    res.status(500).json({ error: errorMessage });
  }
});

// POST /api/square/charge-card-on-file - Charge a saved card
app.post('/api/square/charge-card-on-file', async (req, res) => {
  try {
    const { customerId, amount, currency = 'USD', description, locationId } = req.body;
    
    console.log('🎯🎯🎯 CHARGE CARD ON FILE REQUEST RECEIVED 🎯🎯🎯');
    console.log('🎯 Timestamp:', new Date().toISOString());
    console.log('🎯 Request Body:', JSON.stringify(req.body, null, 2));
    console.log('🎯 Customer ID:', customerId);
    console.log('🎯 Amount (cents):', amount);
    console.log('🎯 Amount (dollars):', amount ? (amount / 100).toFixed(2) : 'N/A');
    console.log('🎯 Currency:', currency);
    console.log('🎯 Description:', description);
    console.log('🎯 Location ID:', locationId);
    console.log('🎯 Square Config Available:', {
      hasAccessToken: !!squareConfig.accessToken,
      tokenLength: squareConfig.accessToken ? squareConfig.accessToken.length : 0,
      baseUrl: squareConfig.baseUrl,
      locationId: squareConfig.locationId
    });

    if (!squareConfig.accessToken) {
      console.log('🎯❌ Square access token not configured');
      return res.status(500).json({ error: 'Payment system not configured' });
    }

    if (!customerId) {
      console.log('🎯❌ Customer ID is missing from request');
      return res.status(400).json({ error: 'Customer ID is required' });
    }

    if (!amount || amount < 100) { // Minimum $1.00 in cents
      console.log('🎯❌ Invalid amount:', amount, '(minimum 100 cents = $1.00)');
      return res.status(400).json({ error: 'Invalid payment amount' });
    }

    // Get customer to verify they exist and check for stored payment methods
    console.log('💳🔍 Retrieving customer information...');
    console.log('💳🔍 Customer ID:', customerId);
    
    const customerResponse = await makeSquareRequest(`/customers/${customerId}`);
    
    if (!customerResponse.customer) {
      console.log('💳❌ Customer not found in response');
      return res.status(400).json({ error: 'Customer not found' });
    }
    
    const customer = customerResponse.customer;
    console.log('💳🔍 Customer found - ID:', customer.id);
    console.log('💳🔍 Customer has cards:', customer.cards ? customer.cards.length : 0);
    
    // Check if customer has any saved cards
    if (!customer.cards || customer.cards.length === 0) {
      console.log('💳❌ No stored payment methods found for customer');
      console.log('💳❌ Customer has no cards saved - cannot charge automatically');
      
      // Without a saved payment method, we cannot charge the customer
      // Square requires a source_id (card ID, card nonce, or other payment method)
      return res.status(400).json({ 
        error: 'Manual collection required',
        message: 'No stored card available. Payment must be collected manually.',
        details: 'Customer exists but has no saved payment methods. A new card payment is required.'
      });
    }

    // Use the first (most recent) card
    const card = customer.cards[0];
    console.log('💳🔍 Using saved card for charge:');
    console.log('💳🔍 Card ID:', card.id);
    console.log('💳🔍 Card last 4:', card.last_4);
    console.log('💳🔍 Card brand:', card.card_brand);
    console.log('💳🔍 Card exp:', card.exp_month + '/' + card.exp_year);

    // Create payment with stored card using direct API request
    const createPaymentRequest = {
      source_id: card.id,
      idempotency_key: randomUUID(),
      amount_money: {
        amount: parseInt(amount),
        currency: currency
      },
      location_id: locationId || squareConfig.locationId,
      note: description,
      customer_id: customerId,
      autocomplete: true
    };

    console.log('💳🔍 Creating payment with saved card...');
    console.log('💳🔍 Payment request:', JSON.stringify(createPaymentRequest, null, 2));

    const paymentResponse = await makeSquareRequest('/payments', 'POST', createPaymentRequest);
    
    console.log('💳🔍 Payment response:', JSON.stringify(paymentResponse, null, 2));
    
    if (paymentResponse.payment) {
      const payment = paymentResponse.payment;
      console.log('💳✅ Successfully charged saved card!');
      console.log('💳✅ Payment ID:', payment.id);
      console.log('💳✅ Payment status:', payment.status);
      console.log('💳✅ Amount charged:', (payment.amount_money.amount / 100) + ' ' + payment.amount_money.currency);

      return res.json({
        success: true,
        payment: {
          id: payment.id,
          status: payment.status,
          amount_money: payment.amount_money,
          created_at: payment.created_at
        }
      });
    } else {
      console.log('💳❌ Payment failed - no payment in response');
      console.log('💳❌ Full response:', JSON.stringify(paymentResponse, null, 2));
      throw new Error('Payment failed');
    }
  } catch (error) {
    console.error('❌ Error in charge-card-on-file endpoint:', error);
    res.status(500).json({ 
      error: 'Manual collection required',
      message: 'No stored card available. Payment must be collected manually.'
    });
  }
});

// POST /api/create-booking-with-payment - Create booking after successful payment
app.post('/api/create-booking-with-payment', async (req, res) => {
  try {
    // Ensure database connection
    if (!db) {
      const connected = await connectToMongo();
      if (!connected) {
        return res.status(500).json({ error: 'Database connection failed' });
      }
    }

    const { bookingData, paymentInfo } = req.body;
    console.log('📋💳 POST /api/create-booking-with-payment - Booking:', bookingData.customer?.name, 'Payment:', paymentInfo.paymentId);

    // CRITICAL: Check availability before creating booking, even after payment
    const serviceDate = new Date(bookingData.service.date);
    const dateString = serviceDate.toISOString().split('T')[0];
    
    console.log('🗓️ Checking calendar availability for booking:', {
      originalDate: bookingData.service.date,
      serviceDate: serviceDate,
      dateString: dateString,
      customerName: bookingData.customer.name
    });
    
    // Get calendar availability for the date
    const calendarCollection = db.collection('calendar_availability');
    const availabilityDoc = await calendarCollection.findOne({ date: dateString });
    const allowedBookings = availabilityDoc?.bookings || 0;
    
    console.log('🗓️ Calendar availability result:', {
      dateString: dateString,
      foundDoc: !!availabilityDoc,
      allowedBookings: allowedBookings,
      fullDoc: availabilityDoc
    });
    
    if (allowedBookings === 0) {
      console.log('🚫 Booking blocked: Date not available in calendar');
      console.log('🚫 Need to set availability for this date in admin calendar');
      return res.status(400).json({ 
        error: 'This date is not available for booking. Please contact admin to set availability for this date.',
        refundNeeded: true 
      });
    }
    
    // Check if the specific time slot is already booked
    const requestedTimeSlot = bookingData.service.timeSlot;
    if (!requestedTimeSlot) {
      console.log('🚫 Booking blocked: No time slot specified');
      return res.status(400).json({ 
        error: 'Time slot is required for booking.',
        refundNeeded: true 
      });
    }
    
    const bookingCollection = db.collection('bookings');
    const existingBookingForSlot = await bookingCollection.findOne({
      $or: [
        { 
          'service.date': dateString,
          'service.timeSlot': requestedTimeSlot
        },
        { 
          'date': dateString,
          'timeSlot': requestedTimeSlot  
        }
      ]
    });
    
    console.log('📊 Time slot availability check:', {
      dateString: dateString,
      requestedTimeSlot: requestedTimeSlot,
      slotAlreadyBooked: !!existingBookingForSlot,
      existingBookingId: existingBookingForSlot?.bookingId
    });
    
    if (existingBookingForSlot) {
      console.log('🚫 Booking blocked: Time slot already booked', { 
        timeSlot: requestedTimeSlot,
        existingBookingId: existingBookingForSlot.bookingId 
      });
      return res.status(400).json({ 
        error: `The ${requestedTimeSlot} time slot is already booked for this date.`,
        refundNeeded: true 
      });
    }

    console.log('✅ Time slot availability check passed:', { 
      dateString: dateString, 
      timeSlot: requestedTimeSlot,
      available: true 
    });

    const collection = db.collection('bookings');
    
    // Add payment info and timestamps to booking
    const booking = {
      customer: bookingData.customer,
      service: {
        ...bookingData.service,
        date: new Date(bookingData.service.date)
      },
      bookingId: `booking_${Date.now()}`,
      paymentInfo: {
        depositPaid: true,
        depositAmount: paymentInfo.amount,
        paymentId: paymentInfo.paymentId,
        customerId: paymentInfo.customerId,
        cardToken: paymentInfo.cardToken,
        paidAt: new Date()
      },
      status: {
        current: 'confirmed',
        history: [
          {
            status: 'pending',
            timestamp: new Date(),
            note: 'Booking created'
          },
          {
            status: 'confirmed', 
            timestamp: new Date(),
            note: `Deposit payment of $${paymentInfo.amount} received via Square`
          }
        ]
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await collection.insertOne(booking);
    console.log('📋💳 Created booking with payment:', result.insertedId);
    
    // Send confirmation emails
    try {
      await sendCustomerConfirmation(bookingData, process.env.RESEND_API_KEY, process.env.DCD_EMAIL);
      await sendDCDNotification(bookingData, process.env.RESEND_API_KEY, process.env.DCD_EMAIL);
    } catch (emailError) {
      console.error('Error sending emails:', emailError);
      // Don't fail booking creation if emails fail
    }
    
    res.json({ success: true, bookingId: booking.bookingId, _id: result.insertedId });
  } catch (error) {
    console.error('❌ Error creating booking with payment:', error);
    res.status(500).json({ error: 'Failed to create booking', details: error.message });
  }
});

// Send booking confirmation emails endpoint
app.post('/api/send-booking-confirmation', async (req, res) => {
  try {
    const { bookingData } = req.body;
    
    if (!bookingData) {
      return res.status(400).json({ error: 'Booking data is required' });
    }
    
    // Send confirmation emails
    await sendCustomerConfirmation(bookingData, process.env.RESEND_API_KEY, process.env.DCD_EMAIL);
    await sendDCDNotification(bookingData, process.env.RESEND_API_KEY, process.env.DCD_EMAIL);
    
    res.json({ success: true, message: 'Booking confirmation emails sent successfully' });
  } catch (error) {
    console.error('❌ Error sending booking confirmation emails:', error);
    res.status(500).json({ error: 'Failed to send emails', details: error.message });
  }
});

// GET /api/send-quote-request - View quote request email preview
app.get('/api/send-quote-request', async (req, res) => {
  try {
    // Redirect to email preview for quote emails
    res.redirect('/api/email-preview?type=quote-customer');
  } catch (error) {
    console.error('❌ Error redirecting to quote preview:', error);
    res.status(500).json({ error: 'Failed to load quote preview' });
  }
});

// POST /api/send-quote-request - Send quote request emails
app.post('/api/send-quote-request', async (req, res) => {
  try {
    const quoteData = req.body;
    
    if (!quoteData) {
      return res.status(400).json({ error: 'Quote data is required' });
    }
    
    console.log('📧 POST /api/send-quote-request - Sending quote request for:', quoteData.name || 'unknown customer');
    
    const { from: fromEmail, to: dcdEmail } = getEmailConfig();
    
    // Create services list text
    const servicesList = quoteData.services.join(', ');
    const leafHaulText = quoteData.leafHaul ? ' (+ Leaf Haul Service $280)' : '';
    
    // Create HTML bullet list for services
    const servicesHtml = quoteData.services.map(service => `<div style="margin: 8px 0; font-size: 16px; color: #374151;">• ${service}</div>`).join('');
    const leafHaulHtml = quoteData.leafHaul ? `<div style="margin: 8px 0; font-size: 16px; color: #374151;">• Leaf Haul Service ($280)</div>` : '';
    
    // Send quote request to business
    await resend.emails.send({
      from: fromEmail,
      to: dcdEmail,
      subject: `New Quote Request from ${quoteData.name}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1f2937; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .booking-details { background: white; padding: 15px; margin: 15px 0; border-radius: 8px; }
            .detail-row { padding: 8px 0; border-bottom: 1px solid #eee; }
            .detail-label { font-weight: bold; min-width: 180px; display: inline-block; vertical-align: top; }
            .detail-value { display: inline-block; vertical-align: top; }
            .services-list { margin: 10px 0; }
            .service-item { padding: 5px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>New Quote Request</h1>
              <p>A customer has submitted a quote request</p>
            </div>
            
            <div class="content">
              <div class="booking-details">
                <h3>Customer Information</h3>
                
                <div class="detail-row">
                  <span class="detail-label">Name:</span>
                  <span class="detail-value">${quoteData.name}</span>
                </div>
                
                <div class="detail-row">
                  <span class="detail-label">Email:</span>
                  <span class="detail-value">${quoteData.email}</span>
                </div>
                
                <div class="detail-row">
                  <span class="detail-label">Phone:</span>
                  <span class="detail-value">${quoteData.phone}</span>
                </div>
                
                <div class="detail-row">
                  <span class="detail-label">Service Address:</span>
                  <span class="detail-value">${quoteData.address}</span>
                </div>
                
                <div class="services-list">
                  <div class="detail-row">
                    <span class="detail-label">Services Requested:</span>
                    <span class="detail-value">
                      ${quoteData.services.map(service => `<div class="service-item">• ${service}</div>`).join('')}
                      ${quoteData.leafHaul ? '<div class="service-item">• Leaf Haul Service (+$280)</div>' : ''}
                    </span>
                  </div>
                </div>
              </div>
              
              ${quoteData.notes ? `
              <div class="booking-details">
                <h3>Additional Notes</h3>
                <div class="detail-row">
                  <span class="detail-label">Notes:</span>
                  <span class="detail-value">${quoteData.notes}</span>
                </div>
              </div>
              ` : ''}
              
              <div class="booking-details">
                <div class="detail-row">
                  <span class="detail-label">Submitted:</span>
                  <span class="detail-value">${new Date(quoteData.submittedAt).toLocaleString()}</span>
                </div>
              </div>
            </div>
            
            <div class="footer">
              <p>DCD Labor - Local Student Powered Labor<br>
              This is an automated message from the DCD Labor website quote request form.</p>
            </div>
          </div>
        </body>
        </html>
      `
    });
    
    // Send confirmation to customer
    await resend.emails.send({
      from: fromEmail,
      to: quoteData.email,
      subject: 'Quote Request Received - DCD Labor',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #22c55e; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .booking-details { background: white; padding: 15px; margin: 15px 0; border-radius: 8px; }
            .detail-row { padding: 8px 0; border-bottom: 1px solid #eee; }
            .detail-label { font-weight: bold; min-width: 180px; display: inline-block; vertical-align: top; }
            .detail-value { display: inline-block; vertical-align: top; }
            .services-list { margin: 10px 0; }
            .service-item { padding: 5px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>DCD Labor - Quote Request Received</h1>
              <p>Thank you for your interest in our landscaping services!</p>
            </div>
            
            <div class="content">
              <h2>Hello ${quoteData.name},</h2>
              <p>We've received your quote request and will get back to you within 48 hours with a detailed estimate.</p>
              
              <div class="booking-details">
                <h3>Your Request Summary</h3>
                
                <div class="detail-row">
                  <span class="detail-label">Service Address:</span>
                  <span class="detail-value">${quoteData.address}</span>
                </div>
                
                <div class="services-list">
                  <div class="detail-row">
                    <span class="detail-label">Services Requested:</span>
                    <span class="detail-value">
                      ${quoteData.services.map(service => `<div class="service-item">• ${service}</div>`).join('')}
                      ${quoteData.leafHaul ? '<div class="service-item">• Leaf Haul Service (+$280)</div>' : ''}
                    </span>
                  </div>
                </div>
              </div>
              
              <h3>What's Next?</h3>
              <ul>
                <li>We'll review your request and prepare a detailed quote</li>
                <li>You'll receive our estimate within 48 hours</li>
              </ul>
              
              <p>In the meantime, if you have any questions, feel free to contact us:</p>
              <div class="booking-details">
                <div class="detail-row">
                  <span class="detail-label">Email:</span>
                  <span class="detail-value">${dcdEmail}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Phone:</span>
                  <span class="detail-value">(973) 945-2076</span>
                </div>
              </div>
              
              <p>Thank you for choosing DCD Labor!</p>
            </div>
            
            <div class="footer">
              <p>DCD Labor - Local Student Powered Labor<br>
              Morris County, New Jersey | ${dcdEmail}</p>
            </div>
          </div>
        </body>
        </html>
      `
    });
    
    console.log('✅ Quote request emails sent successfully for:', quoteData.name);
    res.json({ success: true, message: 'Quote request submitted successfully' });
    
  } catch (error) {
    console.error('❌ Error sending quote request emails:', error);
    res.status(500).json({ error: 'Failed to send quote request', details: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('💥 Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Initialize MongoDB connection (non-blocking for serverless)
connectToMongo().catch(error => {
  console.error('Initial MongoDB connection failed, will retry on first API call:', error);
});

// For Vercel, export the app
export default app;

// For local development, start the server
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 DCD Labor API server running on port ${PORT}`);
    console.log('🌐 Frontend URL configured:', process.env.FRONTEND_URL ? 'Yes' : 'No');
    console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
  });
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down server...');
  await client.close();
  process.exit(0);
});