// MSSQL Connection Test Script
// Run this to debug your MSSQL connection issues

const sql = require('mssql');
require('dotenv').config();

// Database configuration from environment variables
const dbConfig = {
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT) || 1433,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true' || true,
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

async function testConnection() {
  console.log('🔧 MSSQL Connection Test\n');
  
  // Check environment variables
  console.log('📋 Configuration:');
  console.log(`  Server: ${dbConfig.server || 'NOT SET'}`);
  console.log(`  Database: ${dbConfig.database || 'NOT SET'}`);
  console.log(`  User: ${dbConfig.user || 'NOT SET'}`);
  console.log(`  Password: ${dbConfig.password ? '***SET***' : 'NOT SET'}`);
  console.log(`  Port: ${dbConfig.port}`);
  console.log(`  Encrypt: ${dbConfig.options.encrypt}`);
  console.log(`  Trust Cert: ${dbConfig.options.trustServerCertificate}\n`);
  
  // Check for missing required fields
  const missing = [];
  if (!dbConfig.server) missing.push('DB_SERVER');
  if (!dbConfig.database) missing.push('DB_NAME');
  if (!dbConfig.user) missing.push('DB_USER');
  if (!dbConfig.password) missing.push('DB_PASSWORD');
  
  if (missing.length > 0) {
    console.log('❌ Missing required environment variables:');
    missing.forEach(field => console.log(`   - ${field}`));
    console.log('\n💡 Create .env file from .env.example and fill in your credentials\n');
    process.exit(1);
  }
  
  console.log('🔄 Attempting to connect...\n');
  
  try {
    // Create connection pool
    const pool = new sql.ConnectionPool(dbConfig);
    
    // Connect
    await pool.connect();
    console.log('✅ Successfully connected to MSSQL database!\n');
    
    // Test query - check if required tables exist
    console.log('🔍 Testing database schema...');
    
    const request = pool.request();
    
    // Check for Customer table
    try {
      const customerTest = await request.query(`
        SELECT TOP 1 Id, Email, FirstName, LastName, FullName, Deleted 
        FROM dbo.Customer 
        WHERE Deleted = 0
      `);
      console.log(`✅ Customer table found (${customerTest.recordset.length} sample records)`);
    } catch (error) {
      console.log('❌ Customer table not found or inaccessible:', error.message);
    }
    
    // Check for Order table  
    try {
      const orderTest = await request.query(`
        SELECT TOP 1 Id, OrderNumber, CustomerId, OrderStatusId, CreatedOnUtc
        FROM dbo.[Order]
      `);
      console.log(`✅ Order table found (${orderTest.recordset.length} sample records)`);
    } catch (error) {
      console.log('❌ Order table not found or inaccessible:', error.message);
    }
    
    // Check for OrderNote table
    try {
      const noteTest = await request.query(`
        SELECT TOP 1 Id, OrderId, Note, DisplayToCustomer, CreatedOnUtc
        FROM dbo.OrderNote
        WHERE DisplayToCustomer = 1
      `);
      console.log(`✅ OrderNote table found (${noteTest.recordset.length} sample records)`);
    } catch (error) {
      console.log('❌ OrderNote table not found or inaccessible:', error.message);
    }
    
    // Close connection
    await pool.close();
    console.log('\n🎉 Database test completed successfully!');
    console.log('✅ Your MSSQL connection is working properly\n');
    
  } catch (error) {
    console.log('❌ Connection failed:');
    console.log(`   Error: ${error.message}`);
    console.log(`   Code: ${error.code || 'Unknown'}\n`);
    
    // Common error solutions
    console.log('💡 Common solutions:');
    
    if (error.message.includes('getaddrinfo ENOTFOUND')) {
      console.log('   - Check server hostname/IP address');
      console.log('   - Verify you have internet connection');
    }
    
    if (error.message.includes('connect ETIMEDOUT')) {
      console.log('   - Check firewall settings');
      console.log('   - Verify port 1433 is open');
      console.log('   - Check if you need VPN connection');
    }
    
    if (error.message.includes('Login failed')) {
      console.log('   - Verify username and password');
      console.log('   - Check if SQL Server authentication is enabled');
      console.log('   - Ensure user has database access permissions');
    }
    
    if (error.message.includes('SSL')) {
      console.log('   - Try setting DB_ENCRYPT=false for local servers');
      console.log('   - Set DB_TRUST_CERT=true for self-signed certificates');
    }
    
    console.log('\n📖 For more help, check MSSQL-SETUP.md\n');
    process.exit(1);
  }
}

// Run the test
testConnection().catch(console.error);