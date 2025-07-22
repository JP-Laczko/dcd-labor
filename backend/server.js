import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import { Resend } from 'resend';
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
console.log('📧 DCD Email configured:', process.env.DCD_EMAIL);

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
      process.env.FRONTEND_URL,
      'https://admirable-croissant-c6f255.netlify.app'
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

// PUT /api/bookings/:id - Update existing booking
app.put('/api/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const bookingData = req.body;
    console.log('📋 PUT /api/bookings/:id - ID:', id, 'Data:', bookingData);
    
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

// EMAIL ENDPOINTS

// POST /api/send-email - Send booking confirmation emails
app.post('/api/send-email', async (req, res) => {
  try {
    const { bookingData } = req.body;
    console.log('📧 POST /api/send-email - Data:', bookingData);
    
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
      notes: 'Please be careful around the flower beds near the front entrance.'
    };

    let htmlContent;
    if (type === 'customer') {
      htmlContent = await generateCustomerEmailPreview(sampleBookingData, process.env.DCD_EMAIL);
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
        .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .detail-label { font-weight: bold; }
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
              <span class="detail-label">Name: </span>
              <span>${bookingData.customer?.name || bookingData.name}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Email: </span>
              <span>${bookingData.customer?.email || bookingData.email}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Phone: </span>
              <span>${bookingData.customer?.phone || bookingData.phone}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Service Address: </span>
              <span>${bookingData.service?.address || bookingData.address}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Preferred Date: </span>
              <span>${new Date(bookingData.service?.date || bookingData.date).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Crew Size: </span>
              <span>${crewSizeLabels[bookingData.service?.teamSize || bookingData.crewSize] || bookingData.service?.teamSize || bookingData.crewSize}</span>
            </div>
            
            ${(bookingData.yardAcreage) ? `
            <div class="detail-row">
              <span class="detail-label">Approximate Yard Acreage: </span>
              <span>${bookingData.yardAcreage}</span>
            </div>
            ` : ''}
            
            ${(bookingData.services && bookingData.services.length > 0) ? `
            <div class="services-list">
              <div class="detail-label">Services Requested: </div>
              ${bookingData.services.map(service => `<div class="service-item">• ${service}</div>`).join('')}
            </div>
            ` : ''}
            
            <div class="detail-row">
              <span class="detail-label">Rate: </span>
              <span>${rateRange}</span>
            </div>
            
            ${(bookingData.notes || bookingData.service?.description) ? `
            <div class="detail-row">
              <span class="detail-label">Additional Notes: </span>
              <span>${bookingData.notes || bookingData.service?.description}</span>
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
              <span class="detail-label">Name: </span>
              <span>${bookingData.customer?.name || bookingData.name}</span>
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
              <span class="detail-label">Service Address: </span>
              <span>${bookingData.service?.address || bookingData.address}</span>
            </div>
          </div>
          
          <div class="booking-details">
            <h3>Service Details</h3>
            
            <div class="detail-row">
              <span class="detail-label">Preferred Date: </span>
              <span>${new Date(bookingData.service?.date || bookingData.date).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Crew Size: </span>
              <span>${crewSizeLabels[bookingData.service?.teamSize || bookingData.crewSize] || bookingData.service?.teamSize || bookingData.crewSize}</span>
            </div>
            
            ${(bookingData.yardAcreage) ? `
            <div class="detail-row">
              <span class="detail-label">Approximate Yard Acreage: </span>
              <span>${bookingData.yardAcreage}</span>
            </div>
            ` : ''}
            
            ${(bookingData.services && bookingData.services.length > 0) ? `
            <div class="services-list">
              <div class="detail-label">Services Requested: </div>
              ${bookingData.services.map(service => `<div class="service-item">• ${service}</div>`).join('')}
            </div>
            ` : ''}
            
            <div class="detail-row">
              <span class="detail-label">Rate: </span>
              <span>${rateRange}</span>
            </div>
            
            ${(bookingData.notes || bookingData.service?.description) ? `
            <div class="detail-row">
              <span class="detail-label">Additional Notes: </span>
              <span>${bookingData.notes || bookingData.service?.description}</span>
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
    const collection = db.collection('team_rates');
    const ratesDoc = await collection.findOne({});
    
    if (ratesDoc) {
      const crewSizeKey = `${crewSize}Man`;
      const rateInfo = ratesDoc[crewSizeKey];
      
      if (rateInfo) {
        return `$${rateInfo.low} - $${rateInfo.high}/hour`;
      }
    }
    
    // Fallback to default rates if not found in database
    const defaultRates = {
      '2': { low: 50, high: 70 },
      '3': { low: 75, high: 100 },
      '4': { low: 100, high: 130 }
    };
    
    const rateInfo = defaultRates[crewSize?.toString()];
    if (rateInfo) {
      return `$${rateInfo.low} - $${rateInfo.high}/hour`;
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
        .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .detail-label { font-weight: bold; }
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
              <span class="detail-label">Name: </span>
              <span>${bookingData.customer?.name || bookingData.name}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Email: </span>
              <span>${bookingData.customer?.email || bookingData.email}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Phone: </span>
              <span>${bookingData.customer?.phone || bookingData.phone}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Service Address: </span>
              <span>${bookingData.service?.address || bookingData.address}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Preferred Date: </span>
              <span>${new Date(bookingData.service?.date || bookingData.date).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Crew Size: </span>
              <span>${crewSizeLabels[bookingData.service?.teamSize || bookingData.crewSize] || bookingData.service?.teamSize || bookingData.crewSize}</span>
            </div>
            
            ${(bookingData.yardAcreage) ? `
            <div class="detail-row">
              <span class="detail-label">Approximate Yard Acreage: </span>
              <span>${bookingData.yardAcreage}</span>
            </div>
            ` : ''}
            
            ${(bookingData.services && bookingData.services.length > 0) ? `
            <div class="services-list">
              <div class="detail-label">Services Requested: </div>
              ${bookingData.services.map(service => `<div class="service-item">• ${service}</div>`).join('')}
            </div>
            ` : ''}
            
            <div class="detail-row">
              <span class="detail-label">Rate: </span>
              <span>${rateRange}</span>
            </div>
            
            ${(bookingData.notes || bookingData.service?.description) ? `
            <div class="detail-row">
              <span class="detail-label">Additional Notes: </span>
              <span>${bookingData.notes || bookingData.service?.description}</span>
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
              <span class="detail-label">Name: </span>
              <span>${bookingData.customer?.name || bookingData.name}</span>
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
              <span class="detail-label">Service Address: </span>
              <span>${bookingData.service?.address || bookingData.address}</span>
            </div>
          </div>
          
          <div class="booking-details">
            <h3>Service Details</h3>
            
            <div class="detail-row">
              <span class="detail-label">Preferred Date: </span>
              <span>${new Date(bookingData.service?.date || bookingData.date).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Crew Size: </span>
              <span>${crewSizeLabels[bookingData.service?.teamSize || bookingData.crewSize] || bookingData.service?.teamSize || bookingData.crewSize}</span>
            </div>
            
            ${(bookingData.yardAcreage) ? `
            <div class="detail-row">
              <span class="detail-label">Approximate Yard Acreage: </span>
              <span>${bookingData.yardAcreage}</span>
            </div>
            ` : ''}
            
            ${(bookingData.services && bookingData.services.length > 0) ? `
            <div class="services-list">
              <div class="detail-label">Services Requested: </div>
              ${bookingData.services.map(service => `<div class="service-item">• ${service}</div>`).join('')}
            </div>
            ` : ''}
            
            <div class="detail-row">
              <span class="detail-label">Rate: </span>
              <span>${rateRange}</span>
            </div>
            
            ${(bookingData.notes || bookingData.service?.description) ? `
            <div class="detail-row">
              <span class="detail-label">Additional Notes: </span>
              <span>${bookingData.notes || bookingData.service?.description}</span>
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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('💥 Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Initialize MongoDB connection
connectToMongo().catch(console.error);

// For Vercel, export the app
export default app;

// For local development, start the server
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 DCD Labor API server running on port ${PORT}`);
    console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL}`);
    console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
  });
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down server...');
  await client.close();
  process.exit(0);
});