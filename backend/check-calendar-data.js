import { MongoClient } from 'mongodb';

const client = new MongoClient('mongodb+srv://adamcardini:Yrq4zsKYv1SAfjte@availability.tioquw8.mongodb.net/?retryWrites=true&w=majority');

async function checkCalendarData() {
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db('dcd-labor');
    const collection = db.collection('calendar_availability');
    
    console.log('\n📅 August 2025 calendar availability documents:');
    const documents = await collection.find({
      date: {
        $regex: '^2025-08-'
      }
    }).sort({ date: 1 }).toArray();
    
    console.log(`\n📊 Found ${documents.length} August 2025 documents:`);
    
    documents.forEach((doc) => {
      const date = new Date(doc.date);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
      
      console.log(`\n📄 ${doc.date} (${dayName}):`);
      console.log(`  - maxBookings: ${doc.availability?.maxBookings || 0}`);
      console.log(`  - isAvailable: ${doc.availability?.isAvailable || false}`);
      console.log(`  - timeSlots: ${doc.availability?.timeSlots?.length || 0} slots`);
      
      if (doc.availability?.timeSlots && doc.availability.timeSlots.length > 0) {
        doc.availability.timeSlots.forEach((slot, index) => {
          console.log(`    ${index + 1}. ${slot.displayTime} (${slot.time}) - Available: ${slot.isAvailable}`);
        });
      }
    });
    
    // Check which documents have the new format
    const newFormatDocs = documents.filter(doc => doc.availability && doc.availability.timeSlots);
    console.log(`📊 Documents with timeSlots: ${newFormatDocs.length}`);
    
    if (newFormatDocs.length > 0) {
      console.log('\n✅ Sample document with timeSlots:');
      console.log(JSON.stringify(newFormatDocs[0], null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

checkCalendarData();