# MSSQL Database Setup Guide

## Overview

The JavaScript chatbot now includes full MSSQL database integration that connects directly to your remote SQL Server database with the same nopCommerce schema as the React version.

## Quick Setup Steps

### 1. Install Dependencies
```bash
npm install
```

This installs the `mssql` package required for database connectivity.

### 2. Configure Database Connection

Copy the environment file and edit with your credentials:
```bash
cp .env.example .env
```

Edit `.env` with your MSSQL server details:
```env
DB_SERVER=your-server.database.windows.net
DB_NAME=karjistoreDB
DB_USER=your-username
DB_PASSWORD=your-password
DB_ENCRYPT=true
DB_PORT=1433
DB_TRUST_CERT=false
```

### 3. Start the Server
```bash
node server.js
```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DB_SERVER` | Database server hostname or IP | `myserver.database.windows.net` |
| `DB_NAME` | Database name | `karjistoreDB` |
| `DB_USER` | Database username | `myusername` |
| `DB_PASSWORD` | Database password | `MySecurePassword123!` |
| `DB_PORT` | Database port (optional) | `1433` |
| `DB_ENCRYPT` | Enable encryption | `true` (recommended for Azure) |
| `DB_TRUST_CERT` | Trust server certificate | `false` (true for self-signed) |

## Database Schema Requirements

The chatbot expects a nopCommerce-compatible schema with these tables:

### Customer Table
- `Id` (int, primary key)
- `Email` (nvarchar)
- `FirstName` (nvarchar) 
- `LastName` (nvarchar)
- `FullName` (nvarchar)
- `Company` (nvarchar)
- `Deleted` (bit)

### Order Table  
- `Id` (int, primary key)
- `OrderNumber` (nvarchar)
- `CustomerId` (int, foreign key)
- `OrderStatusId` (int)
- `ShippingStatusId` (int)
- `PaymentStatusId` (int)
- `CreatedOnUtc` (datetime)

### OrderNote Table
- `Id` (int, primary key)
- `OrderId` (int, foreign key)
- `Note` (nvarchar)
- `DisplayToCustomer` (bit)
- `CreatedOnUtc` (datetime)

## SQL Queries Used

The chatbot executes these SQL queries:

### Order Lookup
```sql
SELECT 
  o.Id, o.OrderNumber, o.OrderGuid, o.StoreId, o.CustomerId,
  o.OrderStatusId, o.ShippingStatusId, o.PaymentStatusId,
  o.CreatedOnUtc as OrderCreatedOnUtc,
  c.Id as CustomerId_FK, c.Email, c.FirstName, c.LastName, 
  c.FullName, c.Company, c.Active, c.Deleted
FROM dbo.[Order] o
INNER JOIN dbo.Customer c ON o.CustomerId = c.Id
WHERE (CAST(o.Id AS NVARCHAR) = @orderId OR o.OrderNumber = @orderId)
  AND c.Email = @email AND c.Deleted = 0
```

### Order Notes
```sql
SELECT Id, OrderId, Note, DisplayToCustomer, CreatedOnUtc
FROM dbo.OrderNote
WHERE OrderId = @orderId AND DisplayToCustomer = 1
ORDER BY CreatedOnUtc DESC
```

## Status Mapping

The chatbot maps nopCommerce status IDs to readable names:

**Order Status:**
- 10: Pending
- 20: Processing  
- 30: Complete
- 40: Cancelled

**Shipping Status:**
- 10: Not yet shipped
- 20: Partially shipped
- 30: Shipped
- 40: Delivered

## Automatic Fallback

If the database connection fails for any reason, the chatbot automatically falls back to mock data, ensuring it always works for demonstrations and testing.

## Testing Database Connection

The server will show connection status on startup:

```
✅ Connected to MSSQL database successfully
   Server: your-server.database.windows.net
   Database: karjistoreDB
```

Or if connection fails:
```
❌ Database connection failed: [error message]
   Falling back to mock data
```

## Common Issues & Solutions

### Connection Timeout
- Check if your server allows connections from external IPs
- Verify firewall settings allow port 1433
- Ensure VPN connection if required

### Authentication Failed
- Double-check username and password
- Verify the user has access to the specified database
- Check if SQL Server authentication is enabled

### SSL/Encryption Issues
- Set `DB_ENCRYPT=true` for Azure SQL Database
- Set `DB_TRUST_CERT=true` only for self-signed certificates
- Contact your DBA for proper SSL certificate setup

### Database Not Found
- Verify database name spelling
- Ensure user has access to the database
- Check if database exists on the server

## Production Deployment

For production deployments:

1. Use environment variables instead of `.env` file
2. Enable connection pooling (already configured)
3. Use secure connection strings
4. Monitor database connection health
5. Set appropriate timeout values
6. Enable logging for troubleshooting

The chatbot is designed to be resilient and will continue working even if the database becomes temporarily unavailable.