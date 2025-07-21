// Database Configuration
// This file makes it easy to switch between mock data and your real database

export const databaseConfig = {
  // Your MSSQL database connection settings
  server: process.env.DB_SERVER || '',
  database: process.env.DB_NAME || 'karjistoreDB',
  user: process.env.DB_USER || '',
  password: process.env.DB_PASSWORD || '',
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true' || false,
    trustServerCertificate: true,
    requestTimeout: 30000,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

// Check if database is properly configured
export const isDatabaseConfigured = !!(
  databaseConfig.server && 
  databaseConfig.user && 
  databaseConfig.password
);

export const isProduction = process.env.NODE_ENV === 'production';

console.log('📊 Database Status:', {
  configured: isDatabaseConfigured,
  server: databaseConfig.server || 'Not set',
  database: databaseConfig.database,
  environment: process.env.NODE_ENV || 'development'
});