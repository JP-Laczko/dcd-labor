import { MongoClient } from 'mongodb';

const client = new MongoClient('mongodb+srv://adamcardini:Yrq4zsKYv1SAfjte@availability.tioquw8.mongodb.net/?retryWrites=true&w=majority');

async function testTimeSlotUpdate() {
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db('dcd-labor');
    const collection = db.collection('calendar_availability');
    
    const date = '2025-07-25';
    const timeSlots = [
      {"time": "09:00", "displayTime": "9AM", "isAvailable": true, "bookingId": null},
      {"time": "15:00", "displayTime": "3PM", "isAvailable": true, "bookingId": null}
    ];
    
    // Check existing document
    console.log(`\n📅 Checking existing document for ${date}:`);
    const existingDoc = await collection.findOne({ date });
    console.log('Existing:', JSON.stringify(existingDoc, null, 2));
    
    // Create update document
    const updateDoc = {
      date,
      availability: {
        maxBookings: timeSlots.length,
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
    
    if (!existingDoc) {
      updateDoc.metadata.createdAt = new Date();
    }
    
    console.log(`\n📅 Update document:`, JSON.stringify(updateDoc, null, 2));
    
    // Perform the update
    console.log(`\n📅 Performing replaceOne operation...`);
    const result = await collection.replaceOne(
      { date },
      updateDoc,
      { upsert: true }
    );
    
    console.log(`📅 ReplaceOne result:`, result);
    
    // Verify the update
    console.log(`\n📅 Verifying update...`);
    const verifyDoc = await collection.findOne({ date });
    console.log('Updated document:', JSON.stringify(verifyDoc, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

testTimeSlotUpdate();