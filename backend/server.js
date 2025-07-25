import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import { Resend } from 'resend';
import squareup from 'squareup';
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

// Initialize Square (only if we have credentials)
let squareClient = null;
if (process.env.SQUARE_ACCESS_TOKEN) {
  try {
    squareClient = new squareup({
      accessToken: process.env.SQUARE_ACCESS_TOKEN,
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
    });
    console.log('💳 Square client initialized successfully');
  } catch (error) {
    console.error('💳 Square client initialization failed:', error.message);
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
      sendToCustomer: true
    };
  } else {
    return {
      customerFrom: 'DCD Labor <onboarding@resend.dev>',
      adminFrom: 'DCD Labor System <onboarding@resend.dev>',
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
      process.env.FRONTEND_URL
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
    console.log('📊 Database name:', process.env.MONGODB_DB_NAME);
    console.log('📊 Database configured:', process.env.MONGODB_DB_NAME ? 'Yes' : 'No');
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
    
    console.log('📅 Calendar availability from MongoDB:', documents.length, 'documents');
    
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
      
      console.log('📅 Processed', bookings.length, 'bookings to update time slot availability');
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
    
    console.log('📋 Bookings from MongoDB:', documents);
    
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

// PUT /api/bookings/:id - Update existing booking
app.put('/api/bookings/:id', async (req, res) => {
  try {
    // Ensure database connection
    if (!db) {
      await connectToMongo();
    }
    const { id } = req.params;
    const bookingData = req.body;
    console.log('📋 PUT /api/bookings/:id - Updating booking ID:', id, 'for customer:', bookingData.customer?.name || 'unknown customer');
    
    const collection = db.collection('bookings');
    
    // Build the updated booking object
    const updatedBooking = {
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
        timeSlot: bookingData.timeSlot || '',
        displayTime: bookingData.displayTime || '',
        serviceType: bookingData.serviceType || 'estimate',
        notes: bookingData.notes || ''
      },
      updatedAt: new Date()
    };
    
    const result = await collection.updateOne(
      { bookingId: id },
      { $set: updatedBooking }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    console.log('📋 Updated booking:', id);
    res.json({ success: true, bookingId: id });
  } catch (error) {
    console.error('❌ Error updating booking:', error);
    res.status(500).json({ error: 'Failed to update booking' });
  }
});

// DELETE /api/bookings/:id - Delete booking
app.delete('/api/bookings/:id', async (req, res) => {
  try {
    // Ensure database connection
    if (!db) {
      await connectToMongo();
    }
    const { id } = req.params;
    console.log('📋 DELETE /api/bookings/:id - ID:', id);
    
    const collection = db.collection('bookings');
    
    const result = await collection.deleteOne({ bookingId: id });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Booking not found' });
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
    console.log('🔍 Fetching team rates from team_rates collection...');
    const document = await collection.findOne({});
    
    console.log('💰 Team rates document from MongoDB:', document);
    
    if (document) {
      // Remove MongoDB _id field from response
      const { _id, ...rates } = document;
      console.log('💰 Returning stored team rates:', rates);
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
    console.log('📧 POST /api/send-email - Sending email for:', bookingData.customer?.name || 'unknown customer');
    
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
      yardAcreage: '0.5 acres',
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

  const rateRange = await getRateRange(bookingData.service?.teamSize || bookingData.crewSize);

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
              <span class="detail-value">${bookingData.service?.address || bookingData.address}</span>
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
              <span class="detail-value">${crewSizeLabels[bookingData.service?.teamSize || bookingData.crewSize] || bookingData.service?.teamSize || bookingData.crewSize}</span>
            </div>
            
            ${(bookingData.yardAcreage) ? `
            <div class="detail-row">
              <span class="detail-label">Approximate Yard Acreage:</span>
              <span class="detail-value">${bookingData.yardAcreage}</span>
            </div>
            ` : ''}
            
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

  const rateRange = await getRateRange(bookingData.service?.teamSize || bookingData.crewSize);

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
              <span class="detail-value">${bookingData.service?.address || bookingData.address}</span>
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
              <span class="detail-value">${crewSizeLabels[bookingData.service?.teamSize || bookingData.crewSize] || bookingData.service?.teamSize || bookingData.crewSize}</span>
            </div>
            
            ${(bookingData.yardAcreage) ? `
            <div class="detail-row">
              <span class="detail-label">Approximate Yard Acreage:</span>
              <span class="detail-value">${bookingData.yardAcreage}</span>
            </div>
            ` : ''}
            
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
    // Ensure database connection
    if (!db) {
      await connectToMongo();
    }
    const collection = db.collection('team_rates');
    const ratesDoc = await collection.findOne({});
    
    if (ratesDoc) {
      // Map numeric crew size to database key format
      const crewSizeMapping = {
        '2': 'twoMan',
        '3': 'threeMan', 
        '4': 'fourMan'
      };
      
      const dbKey = crewSizeMapping[crewSize?.toString()];
      const rate = ratesDoc[dbKey];
      
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

  const rateRange = await getRateRange(bookingData.service?.teamSize || bookingData.crewSize);

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
              <span class="detail-value">${bookingData.service?.address || bookingData.address}</span>
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
              <span class="detail-value">${crewSizeLabels[bookingData.service?.teamSize || bookingData.crewSize] || bookingData.service?.teamSize || bookingData.crewSize}</span>
            </div>
            
            ${(bookingData.yardAcreage) ? `
            <div class="detail-row">
              <span class="detail-label">Approximate Yard Acreage:</span>
              <span class="detail-value">${bookingData.yardAcreage}</span>
            </div>
            ` : ''}
            
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

  const rateRange = await getRateRange(bookingData.service?.teamSize || bookingData.crewSize);

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
              <span class="detail-value">${bookingData.service?.address || bookingData.address}</span>
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
              <span class="detail-value">${crewSizeLabels[bookingData.service?.teamSize || bookingData.crewSize] || bookingData.service?.teamSize || bookingData.crewSize}</span>
            </div>
            
            ${(bookingData.yardAcreage) ? `
            <div class="detail-row">
              <span class="detail-label">Approximate Yard Acreage:</span>
              <span class="detail-value">${bookingData.yardAcreage}</span>
            </div>
            ` : ''}
            
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
  const googleReviewUrl = "https://g.page/r/CdHSLMhhDOT7EBM/review";
  const websiteUrl = "https://dcd-labor.vercel.app";

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
              <strong>Website:</strong> <a href="${websiteUrl}" target="_blank">dcd-labor.vercel.app</a>
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

  const emailData = {
    from: dcdEmail,
    to: [bookingData.customer?.email || bookingData.email],
    subject: "🌟 Thank you for choosing DCD Labor - Share your experience!",
    html: htmlContent
  };

  return await sendEmailViaResend(emailData, apiKey);
}

async function generateGoogleReviewEmailPreview(bookingData, dcdEmail) {
  const googleReviewUrl = "https://g.page/r/CdHSLMhhDOT7EBM/review";
  const websiteUrl = "https://dcd-labor.vercel.app";

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
              <strong>Website:</strong> <a href="${websiteUrl}" target="_blank">dcd-labor.vercel.app</a>
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
    const { sourceId, amount, currency = 'USD', description, customerInfo, saveCard, locationId } = req.body;
    console.log('💳 POST /api/square/create-payment - Amount:', amount, 'Description:', description);

    if (!squareClient) {
      return res.status(500).json({ error: 'Payment system not configured' });
    }

    if (!amount || amount < 100) { // Minimum $1.00 in cents
      return res.status(400).json({ error: 'Invalid payment amount' });
    }

    const { paymentsApi, customersApi } = squareClient;
    let customerId = null;
    let cardToken = null;

    // Create or find customer if saving card
    if (saveCard && customerInfo) {
      try {
        // Try to create customer
        const createCustomerRequest = {
          givenName: customerInfo.name?.split(' ')[0] || '',
          familyName: customerInfo.name?.split(' ').slice(1).join(' ') || '',
          emailAddress: customerInfo.email,
          phoneNumber: customerInfo.phone
        };

        const customerResponse = await customersApi.createCustomer(createCustomerRequest);
        
        if (customerResponse.result.customer) {
          customerId = customerResponse.result.customer.id;
          console.log('💳 Created Square customer:', customerId);
        }
      } catch (customerError) {
        console.log('💳 Customer creation failed (may already exist):', customerError.message);
        // Continue without customer creation
      }
    }

    // Create payment
    const paymentRequest = {
      sourceId,
      idempotencyKey: randomUUID(),
      amountMoney: {
        amount: BigInt(amount),
        currency
      },
      locationId: locationId || process.env.SQUARE_LOCATION_ID,
      note: description,
      autocomplete: true
    };

    // Add customer ID if we have one
    if (customerId) {
      paymentRequest.customerId = customerId;
    }

    const paymentResponse = await paymentsApi.createPayment(paymentRequest);
    
    if (paymentResponse.result.payment) {
      const payment = paymentResponse.result.payment;
      console.log('💳 Created Square payment:', payment.id);

      // If card was saved and payment successful, get the card token
      if (saveCard && customerId && payment.cardDetails) {
        cardToken = payment.cardDetails.card?.cardId || payment.sourceId;
      }

      res.json({
        success: true,
        payment: {
          id: payment.id,
          status: payment.status,
          amountMoney: payment.amountMoney,
          createdAt: payment.createdAt
        },
        customerId,
        cardToken
      });
    } else {
      throw new Error('Payment creation failed');
    }
  } catch (error) {
    console.error('❌ Error creating Square payment:', error);
    
    let errorMessage = 'Payment processing failed';
    if (error.errors && error.errors.length > 0) {
      errorMessage = error.errors[0].detail || errorMessage;
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
    console.log('💳 POST /api/square/charge-card-on-file - Customer:', customerId, 'Amount:', amount);

    if (!squareClient) {
      return res.status(500).json({ error: 'Payment system not configured' });
    }

    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID is required' });
    }

    if (!amount || amount < 100) { // Minimum $1.00 in cents
      return res.status(400).json({ error: 'Invalid payment amount' });
    }

    const { paymentsApi, customersApi } = squareClient;

    // Get customer's cards
    const customerResponse = await customersApi.retrieveCustomer(customerId);
    
    if (!customerResponse.result.customer || !customerResponse.result.customer.cards || customerResponse.result.customer.cards.length === 0) {
      return res.status(400).json({ error: 'No saved card found for customer' });
    }

    // Use the first (most recent) card
    const card = customerResponse.result.customer.cards[0];

    // Create payment with stored card
    const paymentRequest = {
      sourceId: card.id,
      idempotencyKey: randomUUID(),
      amountMoney: {
        amount: BigInt(amount),
        currency
      },
      locationId: locationId || process.env.SQUARE_LOCATION_ID,
      note: description,
      customerId,
      autocomplete: true
    };

    const paymentResponse = await paymentsApi.createPayment(paymentRequest);
    
    if (paymentResponse.result.payment) {
      const payment = paymentResponse.result.payment;
      console.log('💳 Charged card on file:', payment.id);

      res.json({
        success: true,
        payment: {
          id: payment.id,
          status: payment.status,
          amountMoney: payment.amountMoney,
          createdAt: payment.createdAt
        }
      });
    } else {
      throw new Error('Payment failed');
    }
  } catch (error) {
    console.error('❌ Error charging card on file:', error);
    
    let errorMessage = 'Failed to charge saved card';
    if (error.errors && error.errors.length > 0) {
      errorMessage = error.errors[0].detail || errorMessage;
    }
    
    res.status(500).json({ error: errorMessage });
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
    
    // Get calendar availability for the date
    const calendarCollection = db.collection('calendar');
    const availabilityDoc = await calendarCollection.findOne({ date: dateString });
    const allowedBookings = availabilityDoc?.bookings || 0;
    
    if (allowedBookings === 0) {
      console.log('🚫 Booking blocked: Date not available in calendar');
      return res.status(400).json({ 
        error: 'This date is not available for booking',
        refundNeeded: true 
      });
    }
    
    // Count existing bookings for this date
    const bookingCollection = db.collection('bookings');
    const existingBookings = await bookingCollection.countDocuments({
      $or: [
        { 'service.date': serviceDate },
        { 'date': serviceDate }
      ]
    });
    
    if (existingBookings >= allowedBookings) {
      console.log('🚫 Booking blocked: No slots remaining', { existing: existingBookings, allowed: allowedBookings });
      return res.status(400).json({ 
        error: 'This date is fully booked. No slots remaining.',
        refundNeeded: true 
      });
    }

    console.log('✅ Availability check passed:', { existing: existingBookings, allowed: allowedBookings, remaining: allowedBookings - existingBookings });

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