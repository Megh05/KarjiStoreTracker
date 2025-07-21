# Database Configuration Guide

## Quick Setup for Your MSSQL Database

To connect the chatbot to your actual `karjistoreDB` database, you need to set up environment variables. Here are two ways to do it:

### Method 1: Using Replit Secrets (Recommended)
1. Go to your Replit project
2. Click on "Secrets" in the left sidebar (lock icon)
3. Add these secrets one by one:

```
DB_SERVER = your-sql-server-address.com
DB_NAME = karjistoreDB  
DB_USER = your-username
DB_PASSWORD = your-password
DB_ENCRYPT = true
NODE_ENV = production
```

### Method 2: Using .env File (Alternative)
Create a `.env` file in your project root:

```env
DB_SERVER=your-sql-server-address.com
DB_NAME=karjistoreDB
DB_USER=your-username
DB_PASSWORD=your-password
DB_ENCRYPT=true
NODE_ENV=production
```

## Database Connection Examples

### For Azure SQL Database:
```
DB_SERVER = your-server.database.windows.net
DB_NAME = karjistoreDB
DB_USER = your-admin-user
DB_PASSWORD = your-strong-password
DB_ENCRYPT = true
```

### For Local SQL Server:
```
DB_SERVER = localhost
DB_NAME = karjistoreDB  
DB_USER = sa
DB_PASSWORD = your-password
DB_ENCRYPT = false
```

### For Remote SQL Server:
```
DB_SERVER = 192.168.1.100,1433
DB_NAME = karjistoreDB
DB_USER = karjistore_user
DB_PASSWORD = your-secure-password
DB_ENCRYPT = false
```

## How It Works

The application automatically detects when you've configured a database connection:
- **Development Mode** (no DB_SERVER set): Uses mock data for testing
- **Production Mode** (DB_SERVER configured): Connects to your actual MSSQL database

## Testing the Connection

Once you add your database secrets:
1. The app will automatically restart
2. You'll see "Connected to MSSQL database" in the logs
3. Order tracking will use real data from your database

## Troubleshooting

**Connection Refused**: Check that your SQL Server allows remote connections and the port (usually 1433) is open.

**Login Failed**: Verify your username and password are correct.

**Database Not Found**: Make sure the database name matches exactly (case-sensitive).

**SSL/TLS Issues**: Try setting `DB_ENCRYPT=false` for local/internal servers.