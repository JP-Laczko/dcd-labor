// Test Booking Commands for DCD Labor Backend
// Direct MongoDB operations for system testing and verification

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

// Load environment variables
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
dotenv.config({ path: envFile });

// Fallback to default .env if environment-specific file doesn't exist
if (!process.env.MONGODB_URI) {
  dotenv.config();
}

// MongoDB connection
const client = new MongoClient(process.env.MONGODB_URI);

// Realistic test data sets
const testCustomers = [
  {
    name: "John Smith",
    email: "johnsmith@email.com",
    phone: "(706) 555-0123", 
    address: "1234 Maple Street, Athens, GA 30601"
  },
  {
    name: "Sarah Johnson",
    email: "sarah.johnson@gmail.com",
    phone: "(706) 555-0145",
    address: "567 Oak Avenue, Athens, GA 30605"
  },
  {
    name: "Michael Davis", 
    email: "mdavis@yahoo.com",
    phone: "(706) 555-0167",
    address: "890 Pine Lane, Commerce, GA 30529"
  },
  {
    name: "Emily Wilson",
    email: "emily.wilson@hotmail.com",
    phone: "(706) 555-0189",
    address: "321 Cedar Drive, Madison, GA 30650"
  },
  {
    name: "Robert Garcia",
    email: "r.garcia@outlook.com", 
    phone: "(706) 555-0201",
    address: "456 Birch Court, Watkinsville, GA 30677"
  },
  {
    name: "Jennifer Brown",
    email: "jbrown45@gmail.com",
    phone: "(706) 555-0223",
    address: "789 Elm Street, Jefferson, GA 30549"
  },
  {
    name: "David Martinez",
    email: "david.martinez@live.com",
    phone: "(706) 555-0245", 
    address: "123 Dogwood Road, Dahlonega, GA 30533"
  },
  {
    name: "Lisa Anderson",
    email: "lisa.anderson@icloud.com",
    phone: "(706) 555-0267",
    address: "654 Hickory Way, Cornelia, GA 30531"
  }
];

const yardAcreageOptions = [
  "Under 0.25 acres",
  "0.25 - 0.5 acres",
  "0.5 - 1 acre", 
  "1 - 2 acres",
  "2+ acres"
];

const serviceOptions = [
  ["Lawn Mowing", "Edging"],
  ["Leaf Removal", "Yard Cleanup"],
  ["Hedge Trimming", "Shrub Pruning"],
  ["Lawn Mowing", "Leaf Removal", "Edging"], 
  ["Mulching", "Flower Bed Maintenance"],
  ["Tree Pruning", "Branch Removal"],
  ["Lawn Mowing", "Hedge Trimming", "Yard Cleanup"],
  ["Pressure Washing", "Driveway Cleaning"],
  ["Seasonal Cleanup", "Debris Removal"],
  ["Lawn Care", "Fertilization", "Weed Control"]
];

const timeSlots = [
  { time: "09:00", displayTime: "9AM" },
  { time: "10:00", displayTime: "10AM" },
  { time: "11:00", displayTime: "11AM" },
  { time: "13:00", displayTime: "1PM" },
  { time: "14:00", displayTime: "2PM" },
  { time: "15:00", displayTime: "3PM" }
];

const notesOptions = [
  "Please be careful around the flower beds near the front entrance.",
  "Gate code is 1234. Please close securely after service.",
  "Dog will be inside during service. No issues with crew.",
  "Prefer early morning service if possible.",
  "Additional cleanup needed around back patio area.", 
  "Recently installed sprinkler system - please avoid damage.",
  "Parking available in driveway. Key under flower pot if needed.",
  "Senior citizen discount applicable.",
  "",
  "Special attention needed for rose bushes along fence."
];

// Utility functions
function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function getFutureDate(daysFromNow) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date;
}

function generateBookingId() {
  return `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Generate a test booking object
function generateTestBooking(options = {}) {
  const customer = options.customer || getRandomElement(testCustomers);
  const crewSize = options.crewSize || getRandomElement([2, 3, 4]);
  const serviceType = options.serviceType || getRandomElement(['hourly', 'estimate']);
  const daysFromNow = options.daysFromNow || Math.floor(Math.random() * 14) + 1;
  const timeSlot = options.timeSlot || getRandomElement(timeSlots);
  const serviceDate = options.date ? new Date(options.date) : getFutureDate(daysFromNow);
  
  return {
    bookingId: generateBookingId(),
    customer: {
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address
    },
    service: {
      date: serviceDate,
      timeSlot: timeSlot.time,
      displayTime: timeSlot.displayTime,
      serviceType: serviceType,
      crewSize: crewSize,
      yardAcreage: getRandomElement(yardAcreageOptions),
      services: getRandomElement(serviceOptions),
      notes: getRandomElement(notesOptions),
      hourlyRate: getHourlyRateForCrew(crewSize),
      estimatedHours: null,
      totalCost: null
    },
    status: {
      current: 'pending',
      history: [{
        status: 'pending',
        timestamp: new Date(),
        notes: 'Test booking created automatically'
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
      createdBy: 'test-system',
      assignedCrew: [],
      internalNotes: `Test booking - ${serviceType} service with ${crewSize}-man crew`,
      emailsSent: {
        customerConfirmation: false,
        dcdNotification: false,
        confirmationSent: false,
        reminderSent: false
      }
    }
  };
}

// Get hourly rate for crew size (fallback if not in database)
function getHourlyRateForCrew(crewSize) {
  const defaultRates = {
    2: 85,
    3: 117, 
    4: 140
  };
  return defaultRates[crewSize] || 100;
}

// Database connection wrapper
async function withDatabase(operation) {
  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME);
    const result = await operation(db);
    return result;
  } catch (error) {
    console.error('Database operation failed:', error);
    throw error;
  } finally {
    await client.close();
  }
}

// Test Commands

/**
 * Create a single 2-man crew hourly booking
 */
export async function createTest2ManHourlyBooking() {
  console.log('🧪 Creating test booking: 2-Man Crew (Hourly Service)');
  
  const booking = generateTestBooking({
    crewSize: 2,
    serviceType: 'hourly'
  });
  
  return withDatabase(async (db) => {
    const collection = db.collection('bookings');
    const result = await collection.insertOne(booking);
    
    console.log('✅ Test booking created:', {
      bookingId: booking.bookingId,
      customer: booking.customer.name,
      crewSize: booking.service.crewSize,
      serviceType: booking.service.serviceType,
      date: booking.service.date.toDateString(),
      _id: result.insertedId
    });
    
    return { success: true, booking, _id: result.insertedId };
  });
}

/**
 * Create a single 3-man crew estimate booking
 */
export async function createTest3ManEstimateBooking() {
  console.log('🧪 Creating test booking: 3-Man Crew (Estimate Service)');
  
  const booking = generateTestBooking({
    crewSize: 3,
    serviceType: 'estimate'
  });
  
  return withDatabase(async (db) => {
    const collection = db.collection('bookings');
    const result = await collection.insertOne(booking);
    
    console.log('✅ Test booking created:', {
      bookingId: booking.bookingId,
      customer: booking.customer.name, 
      crewSize: booking.service.crewSize,
      serviceType: booking.service.serviceType,
      date: booking.service.date.toDateString(),
      _id: result.insertedId
    });
    
    return { success: true, booking, _id: result.insertedId };
  });
}

/**
 * Create a single 4-man crew hourly booking
 */
export async function createTest4ManHourlyBooking() {
  console.log('🧪 Creating test booking: 4-Man Crew (Hourly Service)');
  
  const booking = generateTestBooking({
    crewSize: 4,
    serviceType: 'hourly'
  });
  
  return withDatabase(async (db) => {
    const collection = db.collection('bookings');
    const result = await collection.insertOne(booking);
    
    console.log('✅ Test booking created:', {
      bookingId: booking.bookingId,
      customer: booking.customer.name,
      crewSize: booking.service.crewSize,
      serviceType: booking.service.serviceType,
      date: booking.service.date.toDateString(),
      _id: result.insertedId
    });
    
    return { success: true, booking, _id: result.insertedId };
  });
}

/**
 * Create bulk test bookings
 */
export async function createBulkTestBookings(count = 5) {
  console.log(`🧪 Creating ${count} bulk test bookings`);
  
  const bookings = [];
  const crewSizes = [2, 3, 4];
  const serviceTypes = ['hourly', 'estimate'];
  
  for (let i = 0; i < count; i++) {
    const crewSize = crewSizes[i % crewSizes.length];
    const serviceType = serviceTypes[i % serviceTypes.length];
    
    const booking = generateTestBooking({
      crewSize: crewSize,
      serviceType: serviceType,
      daysFromNow: Math.floor(Math.random() * 10) + 1
    });
    
    bookings.push(booking);
  }
  
  return withDatabase(async (db) => {
    const collection = db.collection('bookings');
    const result = await collection.insertMany(bookings);
    
    console.log(`✅ ${result.insertedCount} test bookings created successfully`);
    
    bookings.forEach((booking, index) => {
      console.log(`  ${index + 1}. ${booking.customer.name} - ${booking.service.crewSize}-man crew (${booking.service.serviceType}) on ${booking.service.date.toDateString()}`);
    });
    
    return { 
      success: true, 
      count: result.insertedCount,
      bookings: bookings,
      insertedIds: result.insertedIds
    };
  });
}

/**
 * Create test bookings for the next week
 */
export async function createTestBookingsForNextWeek() {
  console.log('🧪 Creating test bookings for next week (7 days)');
  
  const bookings = [];
  const today = new Date();
  
  for (let i = 1; i <= 7; i++) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + i);
    
    // Skip Sundays (day 0)
    if (targetDate.getDay() === 0) {
      console.log(`⏭️ Skipping Sunday (${targetDate.toDateString()})`);
      continue;
    }
    
    // Create 1-2 bookings per day
    const bookingsPerDay = Math.random() > 0.5 ? 2 : 1;
    
    for (let j = 0; j < bookingsPerDay; j++) {
      const timeSlot = getRandomElement(timeSlots);
      const crewSize = getRandomElement([2, 3, 4]);
      const serviceType = getRandomElement(['hourly', 'estimate']);
      
      const booking = generateTestBooking({
        crewSize: crewSize,
        serviceType: serviceType,
        date: targetDate,
        timeSlot: timeSlot
      });
      
      bookings.push(booking);
    }
  }
  
  return withDatabase(async (db) => {
    const collection = db.collection('bookings');
    const result = await collection.insertMany(bookings);
    
    console.log(`✅ ${result.insertedCount} test bookings created for next week`);
    
    bookings.forEach((booking, index) => {
      console.log(`  ${index + 1}. ${booking.customer.name} - ${booking.service.crewSize}-man crew (${booking.service.serviceType}) on ${booking.service.date.toDateString()} at ${booking.service.displayTime}`);
    });
    
    return {
      success: true,
      count: result.insertedCount, 
      bookings: bookings,
      insertedIds: result.insertedIds
    };
  });
}

/**
 * Create a custom test booking with specific parameters
 */
export async function createCustomTestBooking(customOptions = {}) {
  console.log('🧪 Creating custom test booking with options:', customOptions);
  
  const booking = generateTestBooking(customOptions);
  
  return withDatabase(async (db) => {
    const collection = db.collection('bookings');
    const result = await collection.insertOne(booking);
    
    console.log('✅ Custom test booking created:', {
      bookingId: booking.bookingId,
      customer: booking.customer.name,
      crewSize: booking.service.crewSize,
      serviceType: booking.service.serviceType,
      date: booking.service.date.toDateString(),
      _id: result.insertedId
    });
    
    return { success: true, booking, _id: result.insertedId };
  });
}

/**
 * Get current booking statistics
 */
export async function getBookingStats() {
  console.log('📊 Fetching booking statistics');
  
  return withDatabase(async (db) => {
    const collection = db.collection('bookings');
    
    // Get total bookings
    const totalBookings = await collection.countDocuments();
    
    // Get bookings by status
    const statusStats = await collection.aggregate([
      { $group: { _id: '$status.current', count: { $sum: 1 } } }
    ]).toArray();
    
    // Get bookings by crew size  
    const crewStats = await collection.aggregate([
      { $group: { _id: '$service.crewSize', count: { $sum: 1 } } }
    ]).toArray();
    
    // Get bookings by service type
    const serviceTypeStats = await collection.aggregate([
      { $group: { _id: '$service.serviceType', count: { $sum: 1 } } }
    ]).toArray();
    
    // Get upcoming bookings (next 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    const upcomingBookings = await collection.countDocuments({
      'service.date': { 
        $gte: new Date(),
        $lte: thirtyDaysFromNow
      }
    });
    
    const stats = {
      totalBookings,
      upcomingBookings,
      byStatus: statusStats.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      byCrewSize: crewStats.reduce((acc, item) => {
        acc[`${item._id}-man`] = item.count;
        return acc;
      }, {}),
      byServiceType: serviceTypeStats.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {})
    };
    
    console.log('📊 Booking Statistics:');
    console.log(`  Total Bookings: ${stats.totalBookings}`);
    console.log(`  Upcoming Bookings: ${stats.upcomingBookings}`);
    console.log(`  By Status:`, stats.byStatus);
    console.log(`  By Crew Size:`, stats.byCrewSize);
    console.log(`  By Service Type:`, stats.byServiceType);
    
    return { success: true, stats };
  });
}

/**
 * Clear all test bookings (DANGEROUS - use with caution)
 */
export async function clearAllTestBookings() {
  console.log('🗑️ WARNING: Clearing all test bookings');
  
  const confirm = process.argv.includes('--confirm');
  if (!confirm) {
    console.log('❌ This operation requires --confirm flag');
    console.log('Usage: node test-booking-commands.js clearAllTestBookings --confirm');
    return { success: false, error: 'Confirmation required' };
  }
  
  return withDatabase(async (db) => {
    const collection = db.collection('bookings');
    
    // Only delete bookings created by test system
    const result = await collection.deleteMany({
      'metadata.createdBy': 'test-system'
    });
    
    console.log(`🗑️ Deleted ${result.deletedCount} test bookings`);
    
    return { 
      success: true, 
      deletedCount: result.deletedCount 
    };
  });
}

// CLI interface
async function runCommand(commandName, ...args) {
  try {
    switch (commandName) {
      case 'create2ManHourly':
        return await createTest2ManHourlyBooking();
      case 'create3ManEstimate':
        return await createTest3ManEstimateBooking();
      case 'create4ManHourly':
        return await createTest4ManHourlyBooking();
      case 'createBulk':
        const count = parseInt(args[0]) || 5;
        return await createBulkTestBookings(count);
      case 'createNextWeek':
        return await createTestBookingsForNextWeek();
      case 'createCustom':
        const options = args[0] ? JSON.parse(args[0]) : {};
        return await createCustomTestBooking(options);
      case 'getStats':
        return await getBookingStats();
      case 'clearAllTestBookings':
        return await clearAllTestBookings();
      default:
        console.log('❌ Unknown command:', commandName);
        console.log('Available commands:');
        console.log('  create2ManHourly');
        console.log('  create3ManEstimate');
        console.log('  create4ManHourly'); 
        console.log('  createBulk [count]');
        console.log('  createNextWeek');
        console.log('  createCustom [jsonOptions]');
        console.log('  getStats');
        console.log('  clearAllTestBookings --confirm');
        return { success: false, error: 'Unknown command' };
    }
  } catch (error) {
    console.error('❌ Command failed:', error);
    return { success: false, error: error.message };
  }
}

// Export commands for programmatic use
export const testBookingCommands = {
  createTest2ManHourlyBooking,
  createTest3ManEstimateBooking,
  createTest4ManHourlyBooking,  
  createBulkTestBookings,
  createTestBookingsForNextWeek,
  createCustomTestBooking,
  getBookingStats,
  clearAllTestBookings
};

// CLI runner
if (import.meta.url === `file://${process.argv[1]}`) {
  const [,, commandName, ...args] = process.argv;
  
  if (!commandName) {
    console.log('🧪 DCD Labor Test Booking Commands');
    console.log('Usage: node test-booking-commands.js <command> [args]');
    console.log('');
    console.log('Available commands:');
    console.log('  create2ManHourly                    - Create a 2-man hourly booking');
    console.log('  create3ManEstimate                  - Create a 3-man estimate booking');
    console.log('  create4ManHourly                    - Create a 4-man hourly booking');
    console.log('  createBulk [count]                  - Create multiple test bookings (default: 5)');
    console.log('  createNextWeek                      - Create bookings for next week');
    console.log('  createCustom [jsonOptions]          - Create custom booking with options');
    console.log('  getStats                            - Show booking statistics');
    console.log('  clearAllTestBookings --confirm      - Delete all test bookings');
    console.log('');
    console.log('Examples:');
    console.log('  node test-booking-commands.js create2ManHourly');
    console.log('  node test-booking-commands.js createBulk 10');
    console.log('  node test-booking-commands.js createCustom \'{"crewSize": 3, "serviceType": "hourly"}\'');
    console.log('  node test-booking-commands.js clearAllTestBookings --confirm');
    process.exit(0);
  }
  
  runCommand(commandName, ...args)
    .then(result => {
      if (result.success) {
        console.log('🎉 Command completed successfully');
        process.exit(0);
      } else {
        console.log('❌ Command failed:', result.error);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('💥 Unexpected error:', error);
      process.exit(1);
    });
}

export default testBookingCommands;