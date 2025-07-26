import { MongoClient } from 'mongodb';

const client = new MongoClient('mongodb+srv://adamcardini:Yrq4zsKYv1SAfjte@availability.tioquw8.mongodb.net/?retryWrites=true&w=majority');

async function checkCalendarData() {
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db('dcd-labor');
    const collection = db.collection('calendar_availability');
    
    console.log('\n📅 All calendar availability documents:');
    const documents = await collection.find({}).toArray();
    
    documents.forEach((doc, index) => {
      console.log(`\n📄 Document ${index + 1}:`);
      console.log(JSON.stringify(doc, null, 2));
    });
    
    console.log(`\n📊 Total documents: ${documents.length}`);
    
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