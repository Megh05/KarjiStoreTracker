# 📦 Download Instructions - JavaScript Chatbot

## Download the Zip Bundle

**File:** `karjistore-chatbot-javascript-mssql-v2.0.zip` (28KB)

This zip contains the complete JavaScript version of the KarjiStore customer service chatbot with full MSSQL database connectivity.

## What's Included

```
karjistore-chatbot-javascript-mssql-v2.0.zip
├── index.html          # Main chatbot interface
├── styles.css          # Complete styling and animations  
├── script.js           # Full chatbot functionality
├── server.js           # Node.js server with MSSQL support
├── start.bat           # Windows launcher (auto-installs dependencies)
├── start.sh            # Mac/Linux launcher (auto-installs dependencies)
├── package.json        # Project metadata with MSSQL dependency
├── .env.example        # Database configuration template
├── README.md           # Documentation with setup instructions
├── MSSQL-SETUP.md      # Complete database setup guide
└── run.html            # Testing interface
```

## How to Run Locally

### Method 1: Double-click to start
- **Windows**: Double-click `start.bat`
- **Mac/Linux**: Double-click `start.sh`

### Method 2: Command line
```bash
# Extract the zip file
unzip karjistore-chatbot-javascript-mssql-v2.0.zip
cd karjistore-chatbot-javascript-mssql-v2.0/

# Install dependencies (for MSSQL support)
npm install

# Configure database (optional - uses mock data if not configured)
cp .env.example .env
# Edit .env with your MSSQL server details

# Run with Node.js (recommended for database features)
node server.js

# OR run with Python (mock data only)
python3 -m http.server 8080
```

### Method 3: Direct browser
Simply open `index.html` directly in your browser (some features may be limited due to CORS).

## Demo Credentials

**Working Orders:**
- Email: `john.doe@example.com` / Order: `ORD-2024-001` 
- Email: `jane.smith@company.com` / Order: `ORD-2024-002`

**Error Testing:**
- Email: `wrong@email.com` / Order: `FAKE-ORDER`

## Features

✅ Complete customer service chatbot interface
✅ Order tracking with timeline visualization  
✅ Service selection (Track Order, Returns, Account, General)
✅ Form validation and error handling
✅ Responsive design for all devices
✅ **MSSQL Server connectivity for real data**
✅ **Automatic fallback to mock data if database unavailable**
✅ **nopCommerce schema compatibility**
✅ Environment-based configuration
✅ Connection pooling and error handling
✅ 28KB total bundle size

## Browser Support

- Chrome 90+
- Firefox 88+ 
- Safari 14+
- Edge 90+

## Hybrid Database Support

The JavaScript version includes both MSSQL database connectivity AND built-in mock data fallback:

**With Node.js Server (Full Features):**
- Direct MSSQL Server connection
- Real order data from your database
- nopCommerce schema compatibility
- Automatic fallback to mock data if connection fails

**With Python Server (Basic Mode):**
- Uses built-in mock data only
- Perfect for demos and testing
- No database setup required

Perfect for:
- Production deployment with real database
- Local testing and development
- Offline demonstrations  
- Deployment to any web server
- Integration into existing websites

The chatbot is designed to always work - it gracefully handles database connection issues by automatically switching to mock data.