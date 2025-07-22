// Node.js server for the JavaScript chatbot with MSSQL support
// Run with: node server.js

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Load environment variables
require('dotenv').config();

// Import MSSQL for database connections
let sql;
try {
  sql = require('mssql');
  console.log('✅ MSSQL module loaded successfully');
} catch (error) {
  console.log('⚠️  MSSQL module not installed. Run "npm install" to enable database features.');
}

const PORT = process.env.PORT || 8080;

// Database configuration - replace with your MSSQL server details
const dbConfig = {
  server: process.env.DB_SERVER || 'your-server.database.windows.net',
  database: process.env.DB_NAME || 'karjistoreDB',
  user: process.env.DB_USER || 'your-username',
  password: process.env.DB_PASSWORD || 'your-password',
  port: parseInt(process.env.DB_PORT) || 1433,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true' || true, // Use encryption for Azure
    trustServerCertificate: process.env.DB_TRUST_CERT === 'true' || false,
    enableArithAbort: true,
    requestTimeout: 30000,
    connectionTimeout: 30000
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

// Check if database is configured
const isDatabaseConfigured = () => {
  return process.env.DB_SERVER && process.env.DB_NAME && 
         process.env.DB_USER && process.env.DB_PASSWORD;
};

// Database connection pool
let dbPool = null;

// MIME types for different file extensions
const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css', 
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Initialize database connection
async function initDatabase() {
  if (!sql || !isDatabaseConfigured()) {
    console.log('📋 Database not configured or MSSQL module not available');
    console.log('   Using mock data fallback');
    return null;
  }

  try {
    dbPool = new sql.ConnectionPool(dbConfig);
    await dbPool.connect();
    console.log('✅ Connected to MSSQL database successfully');
    console.log(`   Server: ${dbConfig.server}`);
    console.log(`   Database: ${dbConfig.database}`);
    return dbPool;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.log('   Falling back to mock data');
    return null;
  }
}

// Track order function using real database
async function trackOrderFromDatabase(email, orderId) {
  if (!dbPool) {
    throw new Error('Database not available');
  }

  try {
    const request = dbPool.request();
    request.input('orderId', sql.NVarChar, orderId);
    request.input('email', sql.NVarChar, email);

    // Query to get order with customer details
    const orderResult = await request.query(`
      SELECT 
        o.Id,
        o.OrderNumber,
        o.OrderGuid,
        o.StoreId,
        o.CustomerId,
        o.OrderStatusId,
        o.ShippingStatusId,
        o.PaymentStatusId,
        o.CustomerCurrencyCode,
        o.CurrencyRate,
        o.VatNumber,
        o.OrderSubtotalInclTax,
        o.OrderSubtotalExclTax,
        o.OrderSubTotalDiscountInclTax,
        o.OrderSubTotalDiscountExclTax,
        o.OrderShippingInclTax,
        o.OrderShippingExclTax,
        o.PaymentMethodSystemName,
        o.CreatedOnUtc as OrderCreatedOnUtc,
        c.Id as CustomerId_FK,
        c.CustomerGuid,
        c.Username,
        c.Email,
        c.FirstName,
        c.LastName,
        c.FullName,
        c.Company,
        c.CustomerNumber,
        c.CreatedOnUtc as CustomerCreatedOnUtc,
        c.LastLoginDateUtc,
        c.LastActivityDateUtc,
        c.Active,
        c.Deleted
      FROM dbo.[Order] o
      INNER JOIN dbo.Customer c ON o.CustomerId = c.Id
      WHERE (CAST(o.Id AS NVARCHAR) = @orderId OR o.OrderNumber = @orderId)
        AND c.Email = @email
        AND c.Deleted = 0
    `);

    if (orderResult.recordset.length === 0) {
      return {
        error: 'Order not found',
        message: `No order found with ID "${orderId}" for email "${email}". Please check your details and try again.`
      };
    }

    const orderData = orderResult.recordset[0];

    // Get order notes
    const notesRequest = dbPool.request();
    notesRequest.input('orderId', sql.Int, orderData.Id);
    
    const notesResult = await notesRequest.query(`
      SELECT 
        Id,
        OrderId,
        Note,
        DisplayToCustomer,
        CreatedOnUtc
      FROM dbo.OrderNote
      WHERE OrderId = @orderId
        AND DisplayToCustomer = 1
      ORDER BY CreatedOnUtc DESC
    `);

    // Map status IDs to readable names
    const getOrderStatus = (statusId) => {
      const statusMap = {
        10: 'Pending',
        20: 'Processing', 
        30: 'Complete',
        40: 'Cancelled'
      };
      return statusMap[statusId] || `Order Status ID: ${statusId}`;
    };

    const getShippingStatus = (statusId) => {
      const statusMap = {
        10: 'Not yet shipped',
        20: 'Partially shipped',
        30: 'Shipped',
        40: 'Delivered'
      };
      return statusMap[statusId] || `Shipping Status ID: ${statusId}`;
    };

    // Create timeline from order notes
    const timeline = notesResult.recordset.map((note, index) => ({
      id: note.Id,
      status: note.Note,
      date: note.CreatedOnUtc.toISOString(),
      completed: true,
      isLatest: index === 0 // First item is most recent due to DESC order
    }));

    // Get current status
    const currentStatus = timeline.length > 0 
      ? timeline[0].status 
      : getOrderStatus(orderData.OrderStatusId);

    return {
      order: {
        id: orderData.Id,
        orderNumber: orderData.OrderNumber,
        orderDate: orderData.OrderCreatedOnUtc,
        status: currentStatus,
        customer: {
          name: orderData.FullName || `${orderData.FirstName} ${orderData.LastName}`.trim(),
          email: orderData.Email
        }
      },
      timeline: timeline.reverse() // Reverse to show oldest first in UI
    };

  } catch (error) {
    console.error('Database query error:', error);
    throw new Error('Failed to retrieve order information from database');
  }
}

// Handle API requests
async function handleApiRequest(req, res, pathname) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (pathname === '/api/track-order' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', async () => {
      try {
        const { email, orderId } = JSON.parse(body);
        
        // Validate input
        if (!email || !orderId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            error: 'Validation failed',
            message: 'Email and orderId are required' 
          }));
          return;
        }

        let result;
        try {
          // Try database first
          result = await trackOrderFromDatabase(email, orderId);
        } catch (dbError) {
          // Fallback to mock data
          console.log('Using mock data fallback:', dbError.message);
          result = getMockOrderData(email, orderId);
        }

        const statusCode = result.error ? 404 : 200;
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));

      } catch (parseError) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: 'Invalid JSON',
          message: 'Request body must be valid JSON' 
        }));
      }
    });
    return;
  }

  // API endpoint not found
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    error: 'API endpoint not found',
    message: `${req.method} ${pathname} is not supported` 
  }));
}

// Mock data fallback function
function getMockOrderData(email, orderId) {
  const mockOrders = {
    'john.doe@example.com_ORD-2024-001': {
      order: {
        id: 1,
        orderNumber: 'ORD-2024-001',
        orderDate: '2024-04-03T00:00:00.000Z',
        status: 'Shipped via FedEx - Tracking: 123456789',
        customer: {
          name: 'John Doe',
          email: 'john.doe@example.com'
        }
      },
      timeline: [
        {
          id: 4,
          status: 'Shipped via FedEx - Tracking: 123456789',
          date: '2024-04-05T06:42:04.000Z',
          completed: true,
          isLatest: false
        },
        {
          id: 3,
          status: 'Order processing',
          date: '2024-04-04T09:15:30.000Z',
          completed: true,
          isLatest: false
        },
        {
          id: 2,
          status: 'Payment confirmed',
          date: '2024-04-03T10:35:12.000Z',
          completed: true,
          isLatest: false
        },
        {
          id: 1,
          status: 'Order placed',
          date: '2024-04-03T10:32:49.000Z',
          completed: true,
          isLatest: true
        }
      ]
    },
    'jane.smith@company.com_ORD-2024-002': {
      order: {
        id: 2,
        orderNumber: 'ORD-2024-002',
        orderDate: '2024-04-05T00:00:00.000Z',
        status: 'Out for delivery',
        customer: {
          name: 'Jane Smith',
          email: 'jane.smith@company.com'
        }
      },
      timeline: [
        {
          id: 9,
          status: 'Out for delivery',
          date: '2024-04-08T07:11:38.000Z',
          completed: true,
          isLatest: false
        },
        {
          id: 8,
          status: 'Shipped via UPS - Tracking: 987654321',
          date: '2024-04-07T11:45:22.000Z',
          completed: true,
          isLatest: false
        },
        {
          id: 7,
          status: 'Order processing',
          date: '2024-04-06T14:20:30.000Z',
          completed: true,
          isLatest: false
        },
        {
          id: 6,
          status: 'Payment confirmed',
          date: '2024-04-05T06:42:15.000Z',
          completed: true,
          isLatest: false
        },
        {
          id: 5,
          status: 'Order placed',
          date: '2024-04-05T06:42:09.000Z',
          completed: true,
          isLatest: true
        }
      ]
    }
  };

  const key = `${email}_${orderId}`;
  const mockData = mockOrders[key];
  
  if (mockData) {
    return mockData;
  } else {
    return {
      error: 'Order not found',
      message: `No order found with ID "${orderId}" for email "${email}". Please check your details and try again.`
    };
  }
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;
  
  // Handle API requests
  if (pathname.startsWith('/api/')) {
    handleApiRequest(req, res, pathname);
    return;
  }
  
  // Default to index.html for root
  if (pathname === '/') {
    pathname = '/index.html';
  }
  
  // Build file path
  const filePath = path.join(__dirname, pathname);
  
  // Get file extension
  const ext = path.extname(filePath);
  const contentType = mimeTypes[ext] || 'text/plain';
  
  // Try to read and serve the file
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // File not found
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end(`
          <h1>404 - File Not Found</h1>
          <p>The requested file <code>${pathname}</code> was not found.</p>
          <a href="/">← Back to Chatbot</a>
        `);
      } else {
        // Server error
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(`
          <h1>500 - Internal Server Error</h1>
          <p>Error reading file: ${err.message}</p>
        `);
      }
    } else {
      // Success - serve the file
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    }
  });
});

// Start server with database initialization
async function startServer() {
  // Initialize database connection
  await initDatabase();
  
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 KarjiStore JavaScript Chatbot Server running at:`);
    console.log(`   http://localhost:${PORT}`);
    console.log(`   http://127.0.0.1:${PORT}`);
    console.log(`\n💾 Database Status:`);
    if (dbPool) {
      console.log(`   ✅ Connected to MSSQL: ${dbConfig.server}/${dbConfig.database}`);
    } else {
      console.log(`   📋 Using mock data (database not configured)`);
    }
    console.log(`\n📋 Demo credentials for testing:`);
    console.log(`   • john.doe@example.com / ORD-2024-001`);
    console.log(`   • jane.smith@company.com / ORD-2024-002`);
    console.log(`\n🛑 Press Ctrl+C to stop the server\n`);
  });
}

// Start the server
startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

// Graceful shutdown
// Graceful shutdown
async function gracefulShutdown() {
  console.log('\n🛑 Shutting down server...');
  
  // Close database connection
  if (dbPool) {
    try {
      await dbPool.close();
      console.log('✅ Database connection closed');
    } catch (error) {
      console.error('Error closing database:', error.message);
    }
  }
  
  // Close HTTP server
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);