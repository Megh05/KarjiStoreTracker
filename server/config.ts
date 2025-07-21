// Database Configuration
// This file manages both PostgreSQL (Replit) and MSSQL (production) connections

export const postgresConfig = {
  connectionString: process.env.DATABASE_URL,
  host: process.env.PGHOST,
  port: parseInt(process.env.PGPORT || '5432'),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
};

export const mssqlConfig = {
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

// Check if databases are configured
export const isPostgresConfigured = !!(postgresConfig.connectionString || (postgresConfig.host && postgresConfig.user));
export const isMSSQLConfigured = !!(mssqlConfig.server && mssqlConfig.user && mssqlConfig.password);

export const isDatabaseConfigured = isPostgresConfigured || isMSSQLConfigured;
export const databaseType = isPostgresConfigured ? 'PostgreSQL' : isMSSQLConfigured ? 'MSSQL' : 'Mock';

console.log('Database Status:', {
  configured: isDatabaseConfigured,
  type: databaseType,
  postgres: isPostgresConfigured,
  mssql: isMSSQLConfigured,
  environment: process.env.NODE_ENV || 'development'
});