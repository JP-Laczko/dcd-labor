// Simple HTTP server without external dependencies for testing
import http from 'http';
import url from 'url';

const PORT = 3001;

// In-memory data for testing (replace with MongoDB later)
// Generate dates for current month
const today = new Date();
const currentYear = today.getFullYear();
const currentMonth = today.getMonth();

let calendarAvailability = [
  { date: new Date(currentYear, currentMonth, 23).toISOString().split('T')[0], bookings: 2 }, // 1 actual, 2 allowed = AVAILABLE
  { date: new Date(currentYear, currentMonth, 24).toISOString().split('T')[0], bookings: 2 }, // 2 actual, 2 allowed = UNAVAILABLE  
  { date: new Date(currentYear, currentMonth, 25).toISOString().split('T')[0], bookings: 3 }, // 1 actual, 3 allowed = AVAILABLE
  { date: new Date(currentYear, currentMonth, 26).toISOString().split('T')[0], bookings: 1 }  // 0 actual, 1 allowed = AVAILABLE
];

let bookings = [
  {
    bookingId: "test123",
    service: { date: new Date(currentYear, currentMonth, 23).toISOString().split('T')[0] },
    customer: { name: "Test User 1", email: "test1@example.com" }
  },
  {
    bookingId: "test124",
    service: { date: new Date(currentYear, currentMonth, 24).toISOString().split('T')[0] },
    customer: { name: "Test User 2", email: "test2@example.com" }
  },
  {
    bookingId: "test125", 
    service: { date: new Date(currentYear, currentMonth, 24).toISOString().split('T')[0] },
    customer: { name: "Test User 3", email: "test3@example.com" }
  },
  {
    bookingId: "test126",
    service: { date: new Date(currentYear, currentMonth, 25).toISOString().split('T')[0] },
    customer: { name: "Test User 4", email: "test4@example.com" }
  }
];

// Helper function to parse JSON body with timeout
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let finished = false;
    
    // Add timeout to prevent hanging
    const timeout = setTimeout(() => {
      if (!finished) {
        finished = true;
        reject(new Error('Request timeout'));
      }
    }, 5000); // 5 second timeout
    
    req.on('data', chunk => {
      if (!finished) {
        body += chunk.toString();
      }
    });
    
    req.on('end', () => {
      if (!finished) {
        finished = true;
        clearTimeout(timeout);
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (error) {
          reject(error);
        }
      }
    });
    
    req.on('error', (error) => {
      if (!finished) {
        finished = true;
        clearTimeout(timeout);
        reject(error);
      }
    });
  });
}

// Create server
const server = http.createServer(async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5174');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const query = parsedUrl.query;

  console.log(`${req.method} ${path}`);

  try {
    // Routes
    if (path === '/api/health') {
      res.writeHead(200);
      res.end(JSON.stringify({ 
        status: 'OK', 
        message: 'Simple DCD Labor API is running',
        timestamp: new Date().toISOString()
      }));
      
    } else if (path === '/api/calendar-availability') {
      if (req.method === 'GET') {
        console.log('📅 Returning calendar availability:', calendarAvailability);
        res.writeHead(200);
        res.end(JSON.stringify(calendarAvailability));
        
      } else if (req.method === 'PUT') {
        const body = await parseBody(req);
        console.log('📅 Updating calendar availability:', body);
        
        // Find and update or create new entry
        const { date, bookingChange } = body;
        let existingEntry = calendarAvailability.find(entry => entry.date === date);
        
        if (existingEntry) {
          existingEntry.bookings = Math.max(0, existingEntry.bookings + bookingChange);
        } else {
          calendarAvailability.push({
            date,
            bookings: Math.max(0, 1 + bookingChange)
          });
        }
        
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
      }
      
    } else if (path === '/api/bookings') {
      if (req.method === 'GET') {
        console.log('📋 Returning bookings:', bookings);
        res.writeHead(200);
        res.end(JSON.stringify(bookings));
        
      } else if (req.method === 'POST') {
        const body = await parseBody(req);
        console.log('📋 Creating booking:', body);
        
        const newBooking = {
          ...body,
          bookingId: body.bookingId || `booking_${Date.now()}`,
          createdAt: new Date().toISOString()
        };
        
        bookings.push(newBooking);
        
        res.writeHead(201);
        res.end(JSON.stringify({ success: true, booking: newBooking }));
      }
      
    } else {
      // 404
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Endpoint not found' }));
    }
    
  } catch (error) {
    console.error('❌ Server error:', error);
    res.writeHead(500);
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Simple DCD Labor API server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📅 Calendar data: ${calendarAvailability.length} entries`);
  console.log(`📋 Bookings data: ${bookings.length} entries`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Shutting down server...');
  server.close(() => {
    process.exit(0);
  });
});