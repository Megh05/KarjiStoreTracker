# 📦 Download Instructions - JavaScript Chatbot

## Download the Zip Bundle

**File:** `karjistore-chatbot-javascript-v1.0.zip` (20KB)

This zip contains the complete standalone JavaScript version of the KarjiStore customer service chatbot.

## What's Included

```
karjistore-chatbot-javascript-v1.0.zip
├── index.html          # Main chatbot interface
├── styles.css          # Complete styling and animations  
├── script.js           # Full chatbot functionality
├── server.js           # Node.js server (optional)
├── start.bat           # Windows launcher
├── start.sh            # Mac/Linux launcher  
├── package.json        # Project metadata
├── README.md           # Documentation with demo data
└── run.html            # Testing interface
```

## How to Run Locally

### Method 1: Double-click to start
- **Windows**: Double-click `start.bat`
- **Mac/Linux**: Double-click `start.sh`

### Method 2: Command line
```bash
# Extract the zip file
unzip karjistore-chatbot-javascript-v1.0.zip
cd karjistore-chatbot-javascript-v1.0/

# Run with Node.js (recommended)
node server.js

# OR run with Python 3
python3 -m http.server 8080

# OR run with Python 2  
python -m http.server 8080
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
✅ Works offline with built-in mock data
✅ Zero external dependencies
✅ 20KB total bundle size

## Browser Support

- Chrome 90+
- Firefox 88+ 
- Safari 14+
- Edge 90+

## No Backend Required

The JavaScript version includes built-in mock data, so it works completely standalone without needing the Express.js backend. Perfect for:

- Local testing and development
- Offline demonstrations  
- Deployment to any web server
- Integration into existing websites

The chatbot will automatically fallback to mock data if no backend API is available, ensuring it always works.