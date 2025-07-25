# Development Setup Guide

## Safe Testing with Separate Databases

### 1. Database Setup
- **Production DB**: `dcd_labor_prod` (live data)
- **Development DB**: `dcd_labor_dev` (safe for testing)

### 2. Environment Configuration

**Development** (use `.env.development`):
```bash
MONGODB_DB_NAME=dcd_labor_dev
NODE_ENV=development
SQUARE_ACCESS_TOKEN=sandbox_token...
```

**Production** (use `.env.production`):
```bash  
MONGODB_DB_NAME=dcd_labor_prod
NODE_ENV=production
SQUARE_ACCESS_TOKEN=live_token...
```

### 3. Running the Application

**Development Mode** (safe testing):
```bash
# Backend
cd backend
npm run dev

# Frontend  
cd ..
npm run dev
```

**Production Mode**:
```bash
# Backend
cd backend  
npm start

# Frontend
npm run build
```

### 4. Square Configuration

**Development**: Uses Square Sandbox
- Safe test payments
- No real money processed
- Test cards: `4111 1111 1111 1111`

**Production**: Uses Square Live
- Real payments processed
- Requires Square approval

### 5. Database Safety

✅ **Safe**: Development database (`dcd_labor_dev`)
- Test bookings, calendar changes
- Can be reset/cleaned anytime
- No impact on live site

❌ **Live**: Production database (`dcd_labor_prod`)  
- Real customer data
- Live bookings
- Only use for production

### 6. Quick Setup

1. Copy `.env.development` and add your sandbox credentials
2. Create `dcd_labor_dev` database in MongoDB  
3. Run `npm run dev` in backend
4. Test safely without affecting live data!