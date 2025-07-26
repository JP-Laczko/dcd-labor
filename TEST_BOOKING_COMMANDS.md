# Test Booking Commands - DCD Labor System

This documentation covers the test booking commands created for the DCD Labor booking system. These commands allow you to quickly generate realistic test data to verify system functionality.

## Overview

The test booking commands provide several ways to create test bookings:
- **Frontend Interface**: Admin panel buttons for easy testing
- **Browser Console**: JavaScript commands available globally
- **Backend CLI**: Direct database operations via command line

All test bookings include:
- ✅ Realistic customer data (names, emails, phones, addresses in Georgia)
- ✅ Different crew sizes (2, 3, 4 man crews)
- ✅ Service types (hourly vs estimate)
- ✅ Time slot assignments
- ✅ Varied services (lawn mowing, leaf removal, hedge trimming, etc.)
- ✅ Different yard acreages
- ✅ Authentic notes and special instructions

## Frontend Interface (Admin Panel)

### Accessing the Admin Panel

1. Navigate to `/admin` in your application
2. Log in with admin credentials
3. Scroll down to the "Test Booking Commands" section

### Available Buttons

#### Individual Test Bookings
- **🧪 2-Man Crew (Hourly)** - Creates a single booking with 2-man crew for hourly service
- **🧪 3-Man Crew (Estimate)** - Creates a single booking with 3-man crew for estimate service  
- **🧪 4-Man Crew (Hourly)** - Creates a single booking with 4-man crew for hourly service

#### Bulk Test Data
- **📋 Create 5 Test Bookings** - Creates 5 random bookings with different configurations
- **📅 Fill Next Week with Bookings** - Creates 1-2 bookings per day for the next 7 days

#### Utilities
- **🗑️ Clear Test Bookings (localStorage)** - Removes test bookings from localStorage only

### Status Feedback

The admin panel shows real-time status updates:
- ✅ Success messages with green styling
- ❌ Error messages with red styling  
- 🔄 Progress indicators during execution

## Browser Console Commands

All test commands are available globally in the browser console as `window.testBookingCommands`.

### Basic Usage

```javascript
// Create individual bookings
testBookingCommands.createTest2ManHourlyBooking()
testBookingCommands.createTest3ManEstimateBooking()
testBookingCommands.createTest4ManHourlyBooking()

// Create bulk test data
testBookingCommands.createBulkTestBookings(10)
testBookingCommands.createTestBookingsForNextWeek()

// Create custom booking with specific parameters
testBookingCommands.createCustomTestBooking({
  crewSize: 3,
  serviceType: "hourly",
  daysFromNow: 5
})

// Create booking for specific date and time
testBookingCommands.createTestBookingForTimeSlot(
  "2025-07-30",
  "09:00", 
  "9AM"
)

// Utilities (localStorage only)
testBookingCommands.clearAllTestBookings()
```

### Custom Options

The `createCustomTestBooking()` function accepts these options:

```javascript
{
  customer: { /* specific customer object */ },
  crewSize: 2 | 3 | 4,
  serviceType: "hourly" | "estimate", 
  daysFromNow: number, // days in future
  timeSlot: { time: "09:00", displayTime: "9AM" },
  date: "2025-07-30" // specific date (overrides daysFromNow)
}
```

## Backend CLI Commands

For direct database operations, use the backend CLI script.

### Prerequisites

```bash
cd backend
npm install  # if packages not installed
```

### Available Commands

```bash
# Individual bookings
node test-booking-commands.js create2ManHourly
node test-booking-commands.js create3ManEstimate  
node test-booking-commands.js create4ManHourly

# Bulk operations
node test-booking-commands.js createBulk 10
node test-booking-commands.js createNextWeek

# Custom booking with JSON options
node test-booking-commands.js createCustom '{"crewSize": 3, "serviceType": "hourly"}'

# Statistics and utilities
node test-booking-commands.js getStats
node test-booking-commands.js clearAllTestBookings --confirm
```

### Command Details

#### `create2ManHourly`
Creates a single booking with:
- 2-man crew
- Hourly service type
- Random future date
- Random time slot
- Random customer from test dataset

#### `create3ManEstimate`  
Creates a single booking with:
- 3-man crew
- Estimate service type
- Random future date
- Random time slot
- Random customer from test dataset

#### `create4ManHourly`
Creates a single booking with:
- 4-man crew  
- Hourly service type
- Random future date
- Random time slot
- Random customer from test dataset

#### `createBulk [count]`
Creates multiple bookings (default: 5):
- Cycles through crew sizes (2, 3, 4)
- Alternates service types (hourly, estimate)
- Random dates within next 10 days
- Random customers and services

#### `createNextWeek`
Creates bookings for next 7 days:
- Skips Sundays
- 1-2 bookings per day
- Random crew sizes and service types
- Different time slots per day

#### `createCustom [jsonOptions]`
Creates booking with custom parameters:
```bash
# Examples
node test-booking-commands.js createCustom '{"crewSize": 4}'
node test-booking-commands.js createCustom '{"serviceType": "estimate", "daysFromNow": 3}'
```

#### `getStats`
Shows comprehensive booking statistics:
- Total bookings count
- Upcoming bookings (next 30 days)
- Breakdown by status
- Breakdown by crew size
- Breakdown by service type

#### `clearAllTestBookings --confirm`
**⚠️ DANGEROUS OPERATION**
- Deletes ALL bookings created by test system
- Requires `--confirm` flag for safety
- Only affects bookings with `metadata.createdBy: "test-system"`

## Test Data Details

### Customer Data
8 realistic customers with Georgia addresses:
- John Smith (Athens, GA)
- Sarah Johnson (Athens, GA)  
- Michael Davis (Commerce, GA)
- Emily Wilson (Madison, GA)
- Robert Garcia (Watkinsville, GA)
- Jennifer Brown (Jefferson, GA)
- David Martinez (Dahlonega, GA)
- Lisa Anderson (Cornelia, GA)

### Services Offered
- Lawn Mowing + Edging
- Leaf Removal + Yard Cleanup
- Hedge Trimming + Shrub Pruning
- Mulching + Flower Bed Maintenance
- Tree Pruning + Branch Removal
- Pressure Washing + Driveway Cleaning
- Seasonal Cleanup + Debris Removal
- Lawn Care + Fertilization + Weed Control

### Time Slots
- 9:00 AM (09:00)
- 10:00 AM (10:00)
- 11:00 AM (11:00)
- 1:00 PM (13:00)
- 2:00 PM (14:00)
- 3:00 PM (15:00)

### Yard Acreages
- Under 0.25 acres
- 0.25 - 0.5 acres
- 0.5 - 1 acre
- 1 - 2 acres
- 2+ acres

### Sample Notes
- Gate codes and access instructions
- Pet information
- Special care instructions for landscaping
- Parking and key location details
- Discount eligibility notes

## Integration with Existing System

### MongoDB Integration
- Uses existing `mongoService.createBooking()` function
- Follows same data schema as real bookings
- Integrates with calendar availability system
- Respects time slot booking constraints

### Calendar System Integration
- Checks date availability before creating bookings
- Marks time slots as booked when appropriate
- Integrates with admin calendar view
- Supports both old and new time slot systems

### Payment System Compatibility
- Creates bookings in "pending" status
- Payment fields initialized but not populated
- Compatible with Square payment integration
- Ready for deposit/final payment workflows

## Error Handling

### Frontend (Admin Panel)
- Shows user-friendly error messages
- Handles network failures gracefully
- Provides retry capabilities
- Logs detailed errors to console

### Browser Console  
- Returns promise-based results
- Detailed error logging
- Graceful fallback to localStorage
- Clear success/failure indicators

### Backend CLI
- Comprehensive error logging
- Database connection handling
- Graceful shutdown on errors
- Detailed command feedback

## Security Considerations

### Test Data Identification
- All test bookings marked with `metadata.createdBy: "test-system"`
- Easy to identify and remove test data
- Separated from real customer bookings
- Clear audit trail for cleanup

### Admin Access Required
- Frontend commands require admin authentication
- Backend CLI requires database access
- No public API endpoints for test creation
- Confirmation required for destructive operations

## Troubleshooting

### Common Issues

#### "Database connection failed"
```bash
# Check environment variables
echo $MONGODB_URI
echo $MONGODB_DB_NAME

# Verify .env files exist
ls -la .env*
```

#### "mongoService not available"
```bash
# Ensure you're on admin panel
# Check browser console for import errors
# Verify frontend build is up to date
```

#### "No available time slots"
```bash
# Check calendar availability for target dates
# Use admin calendar to add time slots
# Or use clearAllTestBookings to reset
```

### Debug Mode

Enable debug logging in browser console:
```javascript
localStorage.setItem('debug', 'true')
// Run test commands to see detailed logs
localStorage.removeItem('debug')
```

## Best Practices

### For Development
1. Use frontend admin panel for quick testing
2. Use browser console for scripted testing
3. Use backend CLI for database verification
4. Clear test data regularly to avoid clutter

### For QA Testing
1. Create systematic test scenarios with `createCustomTestBooking()`
2. Use `getStats()` to verify data integrity
3. Test both hourly and estimate workflows
4. Verify different crew sizes work correctly

### For Demonstration
1. Use `createTestBookingsForNextWeek()` for comprehensive demo data
2. Mix crew sizes and service types for variety
3. Include realistic notes and special instructions
4. Show calendar integration with varied availability

## Support

For issues or questions:
1. Check browser console for detailed error messages
2. Verify database connectivity and permissions  
3. Ensure admin authentication is working
4. Check that calendar availability exists for target dates

The test booking commands are designed to be robust and user-friendly, providing comprehensive testing capabilities for the DCD Labor booking system.