import { MongoClient } from 'mongodb';

const client = new MongoClient('mongodb+srv://adamcardini:Yrq4zsKYv1SAfjte@availability.tioquw8.mongodb.net/?retryWrites=true&w=majority');

async function debugAugustDates() {
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db('dcd-labor');
    const collection = db.collection('calendar_availability');
    
    // Check August 29, 30, and 31st of 2025
    const targetDates = ['2025-08-29', '2025-08-30', '2025-08-31'];
    
    for (const targetDate of targetDates) {
      console.log(`\n🔍 Looking for date: ${targetDate}`);
      
      const doc = await collection.findOne({ date: targetDate });
    
      if (doc) {
        console.log(`\n📄 Document for ${targetDate}:`);
        console.log('- maxBookings:', doc.availability?.maxBookings);
        console.log('- currentBookings:', doc.availability?.currentBookings);
        console.log('- isAvailable:', doc.availability?.isAvailable);
        console.log('- timeSlots count:', doc.availability?.timeSlots?.length || 0);
        
        if (doc.availability?.timeSlots && doc.availability.timeSlots.length > 0) {
          console.log('⏰ Time Slots:');
          doc.availability.timeSlots.forEach((slot, index) => {
            console.log(`  ${index + 1}. ${slot.time} (${slot.displayTime}) - Available: ${slot.isAvailable}`);
          });
        } else {
          console.log('⏰ No time slots defined');
        }
        
        // Show what day of week this is
        const date = new Date(targetDate);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
        console.log(`📅 Day of week: ${dayName}`);
        
      } else {
        console.log(`❌ No document found for ${targetDate}`);
      }
      
      // Check for any bookings on this date
      const bookingsCollection = db.collection('bookings');
      const bookings = await bookingsCollection.find({
        'service.date': {
          $gte: new Date(targetDate),
          $lt: new Date(new Date(targetDate).getTime() + 24 * 60 * 60 * 1000)
        }
      }).toArray();
      
      if (bookings.length > 0) {
        console.log(`📋 Found ${bookings.length} bookings:`);
        bookings.forEach((booking, index) => {
          console.log(`  ${index + 1}. Time: ${booking.service?.timeSlot}, Customer: ${booking.customer?.name}`);
        });
      }
      
      console.log('─'.repeat(50));
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

debugAugustDates();