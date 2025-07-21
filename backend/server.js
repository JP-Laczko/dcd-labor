import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// MongoDB connection
let db;
const client = new MongoClient(process.env.MONGODB_URI);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5174',
  credentials: true
}));
app.use(express.json());

// Connect to MongoDB
async function connectToMongo() {
  try {
    await client.connect();
    db = client.db(process.env.MONGODB_DB_NAME);
    console.log('✅ Connected to MongoDB successfully');
    console.log('📊 Database:', process.env.MONGODB_DB_NAME);
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'DCD Labor API is running',
    timestamp: new Date().toISOString(),
    database: db ? 'Connected' : 'Disconnected'
  });
});

// CALENDAR AVAILABILITY ENDPOINTS

// GET /api/calendar-availability - Get all calendar availability
app.get('/api/calendar-availability', async (req, res) => {
  try {
    const collection = db.collection('calendar_availability');
    const documents = await collection.find({}).toArray();
    
    console.log('📅 Calendar availability from MongoDB:', documents);
    
    // Transform MongoDB documents to expected format
    const availability = documents.map(doc => ({
      date: doc.date,
      bookings: doc.bookings || 0
    }));
    
    res.json(availability);
  } catch (error) {
    console.error('❌ Error fetching calendar availability:', error);
    res.status(500).json({ error: 'Failed to fetch calendar availability' });
  }
});

// PUT /api/calendar-availability - Update calendar availability
app.put('/api/calendar-availability', async (req, res) => {
  try {
    const { date, bookingChange, crewCount } = req.body;
    console.log(`📅 PUT /api/calendar-availability - Date: ${date}, Change: ${bookingChange}, CrewCount: ${crewCount}`);
    
    const collection = db.collection('calendar_availability');
    
    // Find existing document or create new one
    const existingDoc = await collection.findOne({ date });
    
    let newBookings;
    
    if (crewCount !== undefined) {
      // Absolute crew count setting (from Edit Crews modal)
      newBookings = Math.max(0, crewCount);
      console.log(`📅 Setting absolute crew count for ${date}: ${newBookings}`);
    } else if (bookingChange !== undefined) {
      // Relative booking change (from booking creation/cancellation)
      if (existingDoc) {
        newBookings = Math.max(0, existingDoc.bookings + bookingChange);
      } else {
        newBookings = Math.max(0, 1 + bookingChange); // Default to 1 allowed booking
      }
      console.log(`📅 Applying booking change for ${date}: ${bookingChange} -> ${newBookings}`);
    } else {
      return res.status(400).json({ error: 'Either bookingChange or crewCount must be provided' });
    }
    
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

// BOOKINGS ENDPOINTS

// GET /api/bookings - Get all bookings with optional filters
app.get('/api/bookings', async (req, res) => {
  try {
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
    const bookingData = req.body;
    console.log('📋 POST /api/bookings - Data:', bookingData);
    
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

// TEAM RATES ENDPOINTS

// GET /api/team-rates - Get team rates
app.get('/api/team-rates', async (req, res) => {
  try {
    const collection = db.collection('team_rates');
    const document = await collection.findOne({});
    
    console.log('💰 Team rates from MongoDB:', document);
    
    if (document) {
      // Remove MongoDB _id field from response
      const { _id, ...rates } = document;
      res.json(rates);
    } else {
      // Return default rates if none found
      const defaultRates = {
        twoMan: { low: 50, high: 70 },
        threeMan: { low: 75, high: 100 },
        fourMan: { low: 100, high: 130 }
      };
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
    const rates = req.body;
    console.log('💰 PUT /api/team-rates - Data:', rates);
    
    const collection = db.collection('team_rates');
    
    // Upsert (update or insert) the rates document
    await collection.replaceOne(
      {}, // Match any document (assuming only one rates document)
      rates,
      { upsert: true }
    );
    
    console.log('💰 Updated team rates');
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error updating team rates:', error);
    res.status(500).json({ error: 'Failed to update team rates' });
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

// Start server
async function startServer() {
  await connectToMongo();
  
  app.listen(PORT, () => {
    console.log(`🚀 DCD Labor API server running on port ${PORT}`);
    console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL}`);
    console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
  });
}

startServer().catch(console.error);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down server...');
  await client.close();
  process.exit(0);
});