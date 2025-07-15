# MongoDB Schema Design for DCD Labor Scheduling

## Recommended Schema with Validation

### 1. Time Slots Collection
```javascript
// Collection: timeSlots
{
  _id: ObjectId,
  date: ISODate("2024-01-15T00:00:00.000Z"), // Use ISODate for proper date handling
  slots: [
    {
      startHour: 8,     // 24-hour format (0-23)
      endHour: 10,      // 24-hour format (0-23)
      isAvailable: true,
      maxBookings: 1    // Allow multiple bookings per slot if needed
    },
    {
      startHour: 10,
      endHour: 12,
      isAvailable: true,
      maxBookings: 1
    },
    {
      startHour: 13,    // 1 PM in 24-hour format
      endHour: 15,      // 3 PM in 24-hour format
      isAvailable: false,
      maxBookings: 1
    }
  ],
  createdAt: ISODate(),
  updatedAt: ISODate()
}
```

### 2. MongoDB Validation Schema
```javascript
db.createCollection("timeSlots", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["date", "slots"],
      properties: {
        date: {
          bsonType: "date",
          description: "Date must be a valid ISODate"
        },
        slots: {
          bsonType: "array",
          minItems: 0,
          maxItems: 20, // Reasonable limit
          items: {
            bsonType: "object",
            required: ["startHour", "endHour", "isAvailable"],
            properties: {
              startHour: {
                bsonType: "int",
                minimum: 0,
                maximum: 23,
                description: "Start hour must be 0-23"
              },
              endHour: {
                bsonType: "int",
                minimum: 1,
                maximum: 24,
                description: "End hour must be 1-24"
              },
              isAvailable: {
                bsonType: "bool",
                description: "Availability status must be boolean"
              },
              maxBookings: {
                bsonType: "int",
                minimum: 1,
                maximum: 10,
                description: "Max bookings must be 1-10"
              }
            }
          }
        }
      }
    }
  }
});
```

### 3. Indexes for Performance
```javascript
// Index for date queries
db.timeSlots.createIndex({ "date": 1 });

// Compound index for date and availability
db.timeSlots.createIndex({ "date": 1, "slots.isAvailable": 1 });
```

## Benefits of This Approach

### ✅ **Error Prevention**
- **Schema Validation**: MongoDB validates data before insertion
- **Type Safety**: Hours must be integers 0-23
- **Range Validation**: Prevents invalid hour values
- **Required Fields**: Ensures critical data is present

### ✅ **Easy Management**
- **24-Hour Format**: No AM/PM confusion (8 = 8am, 14 = 2pm)
- **Simple Numbers**: Easy to type and validate
- **Bulk Operations**: Update multiple slots at once
- **Default Templates**: Create template schedules

### ✅ **Frontend Integration**
```javascript
// Safe conversion for display
function formatTimeSlot(startHour, endHour) {
  const start = startHour <= 12 ? `${startHour}:00 AM` : `${startHour - 12}:00 PM`;
  const end = endHour <= 12 ? `${endHour}:00 AM` : `${endHour - 12}:00 PM`;
  return `${start} - ${end}`;
}

// Example: formatTimeSlot(14, 16) returns "2:00 PM - 4:00 PM"
```

## Sample Data Entry Commands

### Create a Day's Schedule
```javascript
db.timeSlots.insertOne({
  date: new Date("2024-01-15"),
  slots: [
    { startHour: 8, endHour: 10, isAvailable: true, maxBookings: 1 },
    { startHour: 10, endHour: 12, isAvailable: true, maxBookings: 1 },
    { startHour: 13, endHour: 15, isAvailable: false, maxBookings: 1 },
    { startHour: 15, endHour: 17, isAvailable: true, maxBookings: 1 }
  ]
});
```

### Bulk Create Week Schedule
```javascript
const dates = [];
for (let i = 0; i < 7; i++) {
  const date = new Date();
  date.setDate(date.getDate() + i);
  
  dates.push({
    date: date,
    slots: [
      { startHour: 8, endHour: 10, isAvailable: true, maxBookings: 1 },
      { startHour: 10, endHour: 12, isAvailable: true, maxBookings: 1 },
      { startHour: 13, endHour: 15, isAvailable: true, maxBookings: 1 },
      { startHour: 15, endHour: 17, isAvailable: true, maxBookings: 1 }
    ]
  });
}

db.timeSlots.insertMany(dates);
```

### Update Availability
```javascript
// Mark 2 PM slot as unavailable for Jan 15
db.timeSlots.updateOne(
  { date: new Date("2024-01-15") },
  { $set: { "slots.$[elem].isAvailable": false } },
  { arrayFilters: [{ "elem.startHour": 14 }] }
);
```

## Error Handling in Frontend

```javascript
// Safe API call with error handling
async function fetchAvailability(startDate, endDate) {
  try {
    const response = await fetch('/api/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate, endDate })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch availability:', error);
    // Return empty array on error to prevent crash
    return [];
  }
}
```

This schema prevents crashes by:
1. **Validating at database level** - Bad data can't be inserted
2. **Using simple integers** - No parsing complex time strings
3. **Type checking** - MongoDB enforces data types
4. **Error boundaries** - Frontend handles API failures gracefully