# Backend Server Setup

## To fix the "/api/send-quote-request endpoint not found" error:

### 1. Start the Backend Server

The backend server needs to be running for the quote request functionality to work.

**In a separate terminal, navigate to the project root and run:**

```bash
cd backend
npm install
npm run dev
```

This will start the backend server on port 3001.

### 2. Verify the Server is Running

You should see output like:
```
🚀 DCD Labor API server running on port 3001
✅ Connected to MongoDB successfully
📡 Health check: http://localhost:3001/api/health
```

### 3. Test the Endpoint

You can test if the quote request endpoint is working by visiting:
http://localhost:3001/api/health

Or by testing the quote endpoint with a tool like curl:

```bash
curl -X POST http://localhost:3001/api/send-quote-request \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","phone":"123-456-7890","address":"123 Test St","services":["Test Service"],"yardAcreage":"1 acre","notes":"Test","leafHaul":false,"requestType":"quote","submittedAt":"2024-01-01T00:00:00.000Z"}'
```

### 4. Environment Variables

Make sure you have the necessary environment variables set up in `/backend/.env.development`:

```
MONGODB_URI=your_mongodb_connection_string
RESEND_API_KEY=your_resend_api_key
DCD_EMAIL=your_business_email
FRONTEND_URL=http://localhost:5173
```

### 5. Development Workflow

For development, you'll need to run both:
1. **Frontend** (from project root): `npm run dev`
2. **Backend** (from backend folder): `npm run dev`

The frontend runs on port 5173 and proxies API requests to the backend on port 3001.