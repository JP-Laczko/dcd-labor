import { MongoClient } from 'mongodb';

const client = new MongoClient('mongodb+srv://adamcardini:Yrq4zsKYv1SAfjte@availability.tioquw8.mongodb.net/?retryWrites=true&w=majority');

async function checkDatabases() {
  try {
    await client.connect();
    const admin = client.db('admin');
    const databases = await admin.admin().listDatabases();
    
    console.log('📊 All databases in your MongoDB cluster:');
    databases.databases.forEach(db => {
      const size = Math.round(db.sizeOnDisk / 1024);
      const isLive = db.name === 'dcd-labor';
      const isDev = db.name === 'dcd_labor_dev';
      
      if (isLive || isDev) {
        console.log(`  ${isLive ? '🔴' : '🟢'} ${db.name} (${size}KB) ${isLive ? '← LIVE DATA' : '← DEV DATA'}`);
      } else {
        console.log(`  ⚪ ${db.name} (${size}KB)`);
      }
    });
    
    // Check collections in dev database if it exists
    const devDb = client.db('dcd_labor_dev');
    try {
      const collections = await devDb.listCollections().toArray();
      if (collections.length > 0) {
        console.log('\n📁 Collections in dcd_labor_dev:');
        collections.forEach(col => {
          console.log(`  - ${col.name}`);
        });
      } else {
        console.log('\n📁 dcd_labor_dev has no collections yet');
      }
    } catch (error) {
      console.log('\n📁 dcd_labor_dev database not created yet');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.close();
  }
}

checkDatabases();