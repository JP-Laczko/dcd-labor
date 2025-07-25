import { MongoClient } from 'mongodb';

const client = new MongoClient('mongodb+srv://adamcardini:Yrq4zsKYv1SAfjte@availability.tioquw8.mongodb.net/?retryWrites=true&w=majority');

async function setupDevDatabase() {
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const liveDb = client.db('dcd-labor');
    const devDb = client.db('dcd_labor_dev');
    
    // Copy team rates (so you have the same hourly rates)
    console.log('📊 Copying team rates...');
    const rates = await liveDb.collection('team_rates').findOne({});
    if (rates) {
      await devDb.collection('team_rates').replaceOne({}, rates, { upsert: true });
      console.log('✅ Team rates copied');
    } else {
      // Create default rates
      const defaultRates = {
        twoMan: 70,
        threeMan: 100,
        fourMan: 130
      };
      await devDb.collection('team_rates').replaceOne({}, defaultRates, { upsert: true });
      console.log('✅ Default team rates created');
    }
    
    // Create some sample calendar availability for testing (next 7 days)
    console.log('📅 Creating sample calendar availability...');
    const today = new Date();
    const calendarEntries = [];
    
    for (let i = 1; i <= 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateString = date.toISOString().split('T')[0];
      
      calendarEntries.push({
        date: dateString,
        bookings: i % 3 === 0 ? 0 : 2 // Every 3rd day unavailable, others have 2 crews
      });
    }
    
    await devDb.collection('calendar_availability').insertMany(calendarEntries);
    console.log('✅ Sample calendar availability created (7 days)');
    
    // Remove test collection we created earlier
    await devDb.collection('test').drop().catch(() => {});
    console.log('🧹 Removed test collection');
    
    console.log('\\n🎉 Development database ready!');
    console.log('\\n📊 Your databases:');
    console.log('  🔴 dcd-labor (LIVE) - Your production data');
    console.log('  🟢 dcd_labor_dev (DEV) - Ready for testing');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

setupDevDatabase();