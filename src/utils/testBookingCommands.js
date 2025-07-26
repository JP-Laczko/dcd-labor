// Test Booking Commands for DCD Labor System
// This utility provides commands to create test bookings for system verification

import mongoService from '../services/mongoService';

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

// Utility function to get a random element from an array
function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Utility function to get future date
function getFutureDate(daysFromNow) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date;
}

// Generate a single test booking with specified parameters
function generateTestBooking(options = {}) {
  const customer = options.customer || getRandomElement(testCustomers);
  const crewSize = options.crewSize || getRandomElement([2, 3, 4]);
  const serviceType = options.serviceType || getRandomElement(['hourly', 'estimate']);
  const daysFromNow = options.daysFromNow || Math.floor(Math.random() * 14) + 1; // 1-14 days from now
  const timeSlot = options.timeSlot || getRandomElement(timeSlots);
  
  return {
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    address: customer.address,
    date: getFutureDate(daysFromNow),
    crewSize: crewSize,
    yardAcreage: getRandomElement(yardAcreageOptions),
    services: getRandomElement(serviceOptions),
    timeSlot: timeSlot.time,
    displayTime: timeSlot.displayTime,
    serviceType: serviceType,
    notes: getRandomElement(notesOptions)
  };
}

// Test Commands - Individual booking creation functions

/**
 * Create a test booking with 2-man crew (hourly service)
 */
export async function createTest2ManHourlyBooking() {
  console.log('🧪 Creating test booking: 2-Man Crew (Hourly Service)');
  
  const bookingData = generateTestBooking({
    crewSize: 2,
    serviceType: 'hourly'
  });
  
  console.log('📋 Booking Data:', bookingData);
  
  try {
    const result = await mongoService.createBooking(bookingData);
    if (result.success) {
      console.log('✅ Test booking created successfully:', result.booking);
      return result;
    } else {
      console.error('❌ Failed to create test booking:', result.error);
      return result;
    }
  } catch (error) {
    console.error('❌ Error creating test booking:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create a test booking with 3-man crew (estimate service)  
 */
export async function createTest3ManEstimateBooking() {
  console.log('🧪 Creating test booking: 3-Man Crew (Estimate Service)');
  
  const bookingData = generateTestBooking({
    crewSize: 3,
    serviceType: 'estimate'
  });
  
  console.log('📋 Booking Data:', bookingData);
  
  try {
    const result = await mongoService.createBooking(bookingData);
    if (result.success) {
      console.log('✅ Test booking created successfully:', result.booking);
      return result;
    } else {
      console.error('❌ Failed to create test booking:', result.error);
      return result;
    }
  } catch (error) {
    console.error('❌ Error creating test booking:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create a test booking with 4-man crew (hourly service)
 */
export async function createTest4ManHourlyBooking() {
  console.log('🧪 Creating test booking: 4-Man Crew (Hourly Service)');
  
  const bookingData = generateTestBooking({
    crewSize: 4,
    serviceType: 'hourly'
  });
  
  console.log('📋 Booking Data:', bookingData);
  
  try {
    const result = await mongoService.createBooking(bookingData);
    if (result.success) {
      console.log('✅ Test booking created successfully:', result.booking);
      return result;
    } else {
      console.error('❌ Failed to create test booking:', result.error);
      return result;
    }
  } catch (error) {
    console.error('❌ Error creating test booking:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create a test booking for a specific date and time slot
 */
export async function createTestBookingForTimeSlot(date, timeSlot, displayTime) {
  console.log(`🧪 Creating test booking for specific time: ${date} at ${displayTime}`);
  
  const bookingData = generateTestBooking({
    daysFromNow: null, // Override with specific date
    timeSlot: { time: timeSlot, displayTime: displayTime }
  });
  
  // Override the date with the specific date provided
  bookingData.date = new Date(date);
  bookingData.timeSlot = timeSlot;
  bookingData.displayTime = displayTime;
  
  console.log('📋 Booking Data:', bookingData);
  
  try {
    const result = await mongoService.createBooking(bookingData);
    if (result.success) {
      console.log('✅ Test booking created successfully:', result.booking);
      return result;
    } else {
      console.error('❌ Failed to create test booking:', result.error);
      return result;
    }
  } catch (error) {
    console.error('❌ Error creating test booking:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create multiple test bookings to fill up different scenarios
 */
export async function createBulkTestBookings(count = 5) {
  console.log(`🧪 Creating ${count} bulk test bookings`);
  
  const results = [];
  const crewSizes = [2, 3, 4];
  const serviceTypes = ['hourly', 'estimate'];
  
  for (let i = 0; i < count; i++) {
    const crewSize = crewSizes[i % crewSizes.length];
    const serviceType = serviceTypes[i % serviceTypes.length];
    
    console.log(`🧪 Creating booking ${i + 1}/${count}: ${crewSize}-man crew (${serviceType})`);
    
    const bookingData = generateTestBooking({
      crewSize: crewSize,
      serviceType: serviceType,
      daysFromNow: Math.floor(Math.random() * 10) + 1 // 1-10 days from now
    });
    
    try {
      const result = await mongoService.createBooking(bookingData);
      results.push(result);
      
      if (result.success) {
        console.log(`✅ Booking ${i + 1} created successfully`);
      } else {
        console.error(`❌ Booking ${i + 1} failed:`, result.error);
      }
      
      // Small delay between bookings to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`❌ Error creating booking ${i + 1}:`, error);
      results.push({ success: false, error: error.message });
    }
  }
  
  const successCount = results.filter(r => r.success).length;
  console.log(`🎉 Bulk booking creation complete: ${successCount}/${count} successful`);
  
  return results;
}

/**
 * Create test bookings for next week to demonstrate time slot functionality
 */
export async function createTestBookingsForNextWeek() {
  console.log('🧪 Creating test bookings for next week (7 days)');
  
  const results = [];
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
      
      console.log(`🧪 Creating booking for ${targetDate.toDateString()} at ${timeSlot.displayTime} (${crewSize}-man crew, ${serviceType})`);
      
      try {
        const result = await createTestBookingForTimeSlot(
          targetDate.toISOString().split('T')[0],
          timeSlot.time,
          timeSlot.displayTime
        );
        
        results.push({
          date: targetDate.toDateString(),
          timeSlot: timeSlot.displayTime,
          crewSize,
          serviceType,
          result
        });
        
        // Delay between bookings
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (error) {
        console.error(`❌ Error creating booking for ${targetDate.toDateString()}:`, error);
        results.push({
          date: targetDate.toDateString(),
          timeSlot: timeSlot.displayTime,
          crewSize,
          serviceType,
          result: { success: false, error: error.message }
        });
      }
    }
  }
  
  const successCount = results.filter(r => r.result.success).length;
  console.log(`🎉 Next week booking creation complete: ${successCount}/${results.length} successful`);
  
  return results;
}

/**
 * Create a custom test booking with specific parameters
 */
export async function createCustomTestBooking(customOptions = {}) {
  console.log('🧪 Creating custom test booking with options:', customOptions);
  
  const bookingData = generateTestBooking(customOptions);
  
  console.log('📋 Custom Booking Data:', bookingData);
  
  try {
    const result = await mongoService.createBooking(bookingData);
    if (result.success) {
      console.log('✅ Custom test booking created successfully:', result.booking);
      return result;
    } else {
      console.error('❌ Failed to create custom test booking:', result.error);
      return result;
    }
  } catch (error) {
    console.error('❌ Error creating custom test booking:', error);
    return { success: false, error: error.message };
  }
}

// Convenience function to clear all test bookings (localStorage only - for development)
export async function clearAllTestBookings() {
  console.log('🧹 Clearing all test bookings (localStorage only)');
  
  try {
    // This only works for localStorage fallback - MongoDB bookings need to be deleted via admin
    localStorage.removeItem('dcd_bookings');
    console.log('✅ Test bookings cleared from localStorage');
    return { success: true, message: 'Test bookings cleared from localStorage' };
  } catch (error) {
    console.error('❌ Error clearing test bookings:', error);
    return { success: false, error: error.message };
  }
}

// Export all functions for browser console access
export const testBookingCommands = {
  createTest2ManHourlyBooking,
  createTest3ManEstimateBooking,
  createTest4ManHourlyBooking,
  createTestBookingForTimeSlot,
  createBulkTestBookings,
  createTestBookingsForNextWeek,
  createCustomTestBooking,
  clearAllTestBookings
};

// Make available globally for browser console
if (typeof window !== 'undefined') {
  window.testBookingCommands = testBookingCommands;
  console.log('🧪 Test booking commands available globally as window.testBookingCommands');
  console.log('📖 Available commands:');
  console.log('  - testBookingCommands.createTest2ManHourlyBooking()');
  console.log('  - testBookingCommands.createTest3ManEstimateBooking()');
  console.log('  - testBookingCommands.createTest4ManHourlyBooking()');
  console.log('  - testBookingCommands.createBulkTestBookings(5)');
  console.log('  - testBookingCommands.createTestBookingsForNextWeek()');
  console.log('  - testBookingCommands.createCustomTestBooking({ crewSize: 3, serviceType: "hourly" })');
  console.log('  - testBookingCommands.clearAllTestBookings()');
}

export default testBookingCommands;