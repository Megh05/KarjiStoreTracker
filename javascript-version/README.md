# KarjiStore Customer Service Chatbot - JavaScript Version

A plain JavaScript, HTML, and CSS implementation of the KarjiStore customer service chatbot with identical functionality to the React version.

## Quick Start

### Option 1: Double-click to run (Windows/Mac/Linux)
- **Windows**: Double-click `start.bat`
- **Mac/Linux**: Double-click `start.sh` or run `./start.sh` in terminal

### Option 2: Manual start
```bash
# With Node.js (recommended)
node server.js

# With Python 3
python3 -m http.server 8080

# With Python 2
python -m http.server 8080
```

Then open your browser to: **http://localhost:8080**

## MSSQL Database Setup

### Quick Setup
1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env`
3. Edit `.env` with your database credentials:
   ```env
   DB_SERVER=your-server.database.windows.net
   DB_NAME=karjistoreDB
   DB_USER=your-username
   DB_PASSWORD=your-password
   DB_ENCRYPT=true
   ```
4. Start server: `node server.js`

### Environment Variables
Configure your MSSQL connection using these environment variables:

- `DB_SERVER` - Database server hostname
- `DB_NAME` - Database name (e.g., karjistoreDB) 
- `DB_USER` - Database username
- `DB_PASSWORD` - Database password
- `DB_PORT` - Database port (default: 1433)
- `DB_ENCRYPT` - Enable encryption (true/false)
- `DB_TRUST_CERT` - Trust server certificate (true/false)

### Fallback Mode
If database connection fails, the server automatically falls back to mock data, ensuring the chatbot always works.

## Features

✅ **Complete Feature Parity**
- Order tracking with real-time timeline visualization
- Service selection interface (Track Order, Returns, Account Support, General)
- Interactive order tracking form with validation
- Order details modal with visual progress timeline
- Error handling with friendly messages and retry options
- Character counter and input validation
- Auto-resizing chat input
- Reload conversation functionality
- Responsive design for all screen sizes

✅ **Modern UI/UX**
- Clean, professional design matching the React version
- Smooth animations and transitions
- Loading states and visual feedback
- Accessible keyboard navigation
- Mobile-optimized responsive layout

✅ **Real Order Integration**
- Connects to same backend API (`/api/track-order`)
- Works with existing mock data and SQL database
- Same demo credentials work:
  - `john.doe@example.com` / `ORD-2024-001`
  - `jane.smith@company.com` / `ORD-2024-002`

## Demo Data for Testing

### Working Orders
1. **John Doe - Delivered Order**
   - Email: `john.doe@example.com`
   - Order ID: `ORD-2024-001`
   - Shows 4-step timeline with FedEx tracking

2. **Jane Smith - Out for Delivery**
   - Email: `jane.smith@company.com` 
   - Order ID: `ORD-2024-002`
   - Shows 5-step timeline with UPS tracking

### Error Testing
- Email: `wrong@email.com`
- Order ID: `FAKE-ORDER`
- Shows friendly error with retry options

## File Structure

```
javascript-version/
├── index.html          # Main HTML structure
├── styles.css          # Complete CSS with theming
├── script.js           # Full JavaScript functionality
└── README.md           # This documentation
```

## Usage

1. **Development**: Open `index.html` directly in browser
2. **Production**: Serve files through any web server
3. **Integration**: Works with existing Express.js backend

## Key JavaScript Features

- **ES6+ Classes**: Modern object-oriented structure
- **Async/Await**: For API calls and smooth UX
- **Event Delegation**: Efficient event handling
- **Local Storage**: Session management
- **Responsive Design**: CSS Grid and Flexbox
- **Accessibility**: ARIA labels and keyboard support

## API Integration

The chatbot connects to the same backend endpoints:

```javascript
// Order tracking
POST /api/track-order
{
  "email": "john.doe@example.com",
  "orderId": "ORD-2024-001"
}
```

## Styling System

Uses CSS custom properties for consistent theming:

```css
:root {
  --primary: 220, 90%, 56%;
  --background: 0, 0%, 100%;
  --foreground: 222, 84%, 5%;
  /* ... more theme variables */
}
```

## Browser Support

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## Performance

- **Zero Dependencies**: Pure vanilla JavaScript
- **Small Bundle**: ~50KB total (HTML + CSS + JS)
- **Fast Loading**: No build step required
- **Smooth Animations**: 60fps CSS transitions

## Comparison with React Version

| Feature | React Version | JavaScript Version |
|---------|---------------|-------------------|
| Framework | React + TypeScript | Vanilla JavaScript |
| Bundle Size | ~500KB+ | ~50KB |
| Dependencies | 50+ packages | 1 (Lucide icons CDN) |
| Build Process | Vite + bundling | None required |
| Functionality | ✅ Complete | ✅ Identical |
| Performance | Fast | Faster |

This implementation proves that complex, modern UI/UX can be achieved with plain JavaScript while maintaining all the functionality of framework-based solutions.