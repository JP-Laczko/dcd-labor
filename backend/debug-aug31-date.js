// Check what day August 31, 2025 falls on
const targetDate = new Date('2025-08-31');
console.log('August 31, 2025 falls on:', targetDate.toLocaleDateString('en-US', { weekday: 'long' }));
console.log('Day of week (0=Sunday, 6=Saturday):', targetDate.getDay());

// Check if it's after August 25, 2024 (it should be)
const august25 = new Date('2024-08-25');
console.log('Is after August 25, 2024:', targetDate >= august25);

// So according to the generateDefaultTimeSlots logic:
const dayOfWeek = targetDate.getDay();
const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
console.log('Is weekend:', isWeekend);

if (isWeekend) {
  console.log('Expected time slots: 9AM and 1PM');
} else {
  console.log('Expected time slots: 3PM only');
}

// But the database shows 9AM and 3PM, which means this was manually set in admin