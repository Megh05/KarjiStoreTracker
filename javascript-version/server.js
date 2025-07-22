// Simple Node.js server for the JavaScript chatbot
// Run with: node server.js

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 8080;

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

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;
  
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

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 KarjiStore JavaScript Chatbot Server running at:`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   http://127.0.0.1:${PORT}`);
  console.log(`\n📋 Demo credentials for testing:`);
  console.log(`   • john.doe@example.com / ORD-2024-001`);
  console.log(`   • jane.smith@company.com / ORD-2024-002`);
  console.log(`\n🛑 Press Ctrl+C to stop the server\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Server stopped.');
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Server terminated.');
  server.close();
  process.exit(0);
});