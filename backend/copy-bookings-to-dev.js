import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

// Load production environment to get connection details
dotenv.config({ path: '../.env.production' });

const MONGODB_URI = process.env.MONGODB_URI;
const PROD_DB_NAME = 'dcd-labor';
const DEV_DB_NAME = 'dcd_labor_dev';

async function copyBookingsToDevDatabase() {
  let client;
  
  try {
    console.log('🔗 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    // Get both databases
    const prodDb = client.db(PROD_DB_NAME);
    const devDb = client.db(DEV_DB_NAME);
    
    // Get bookings from production database
    console.log('📊 Fetching bookings from production database...');
    const prodBookings = prodDb.collection('bookings');
    const bookings = await prodBookings.find({}).toArray();
    
    console.log(`Found ${bookings.length} bookings in production database`);
    
    if (bookings.length === 0) {
      console.log('No bookings to copy');
      return;
    }
    
    // Copy bookings to dev database
    console.log('📋 Copying bookings to dev database...');
    const devBookings = devDb.collection('bookings');
    
    // Clear existing bookings in dev database first
    const deleteResult = await devBookings.deleteMany({});
    console.log(`Cleared ${deleteResult.deletedCount} existing bookings from dev database`);
    
    // Insert all bookings into dev database
    const insertResult = await devBookings.insertMany(bookings);
    console.log(`✅ Successfully copied ${insertResult.insertedCount} bookings to dev database`);
    
    // Show some sample data
    const sampleBookings = await devBookings.find({}).limit(3).toArray();
    console.log('\n📋 Sample bookings copied:');
    sampleBookings.forEach((booking, index) => {
      console.log(`${index + 1}. ${booking.name} - ${booking.email} - ${booking.date} ${booking.time}`);
    });
    
  } catch (error) {
    console.error('❌ Error copying bookings:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('🔐 Database connection closed');
    }
  }
}

// Run the copy operation
copyBookingsToDevDatabase();