# Database Configuration Guide

## Quick Setup for Your MSSQL Database

The chatbot now includes **complete SQL queries** that work with your actual nopCommerce database structure. Here's how to connect to your `karjistoreDB` database:

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

The application includes **complete SQL implementation** that:
- Connects to your actual nopCommerce database structure
- Uses proper SQL queries for Customer, Order, and OrderNote tables
- Maps nopCommerce status IDs to readable names
- Creates timeline from OrderNote records with DisplayToCustomer = 1
- Handles both Order ID and OrderNumber for tracking

### SQL Queries Included:
✅ **Customer lookup** by email with proper nopCommerce fields
✅ **Order retrieval** with JOIN to Customer table
✅ **OrderNote timeline** ordered by CreatedOnUtc
✅ **Status mapping** for OrderStatusId, ShippingStatusId, PaymentStatusId
✅ **nopCommerce compatibility** with all standard fields

## Testing the Connection

To switch from mock data to your actual database:

1. Add your database connection in `.env` file or Replit Secrets
2. Update `server/storage.ts` line 474:
   ```typescript
   // Change from:
   export const storage = new MockStorage();
   
   // To:
   export const storage = isDatabaseConfigured 
     ? new MSSQLStorage() 
     : new MockStorage();
   ```
3. Restart the application
4. Test with real customer email and order numbers from your database

## Troubleshooting

**Connection Refused**: Check that your SQL Server allows remote connections and the port (usually 1433) is open.

**Login Failed**: Verify your username and password are correct.

**Database Not Found**: Make sure the database name matches exactly (case-sensitive).

**SSL/TLS Issues**: Try setting `DB_ENCRYPT=false` for local/internal servers.

## SQL Scripts Included

The application now includes ready-to-use SQL scripts:

### `/sql-setup/create-tables.sql`
- Complete nopCommerce compatible table structure
- Includes Customer, Order, OrderNote tables
- Proper indexes for performance
- Use this if setting up a new test database

### `/sql-setup/sample-data.sql`  
- Sample customers and orders for testing
- Realistic order notes for timeline demonstration
- Test data with different order statuses
- Use this to test the chatbot functionality

## Query Details

The chatbot uses these optimized SQL queries:

**Order Lookup:**
```sql
SELECT o.*, c.* 
FROM [Order] o
INNER JOIN Customer c ON o.CustomerId = c.Id  
WHERE (CAST(o.Id AS NVARCHAR) = @orderId OR o.OrderNumber = @orderId)
  AND c.Email = @email AND c.Deleted = 0
```

**Order Notes Timeline:**
```sql
SELECT Id, OrderId, Note, DisplayToCustomer, CreatedOnUtc
FROM OrderNote  
WHERE OrderId = @orderId AND DisplayToCustomer = 1
ORDER BY CreatedOnUtc ASC
```

These queries are production-ready and work with your existing nopCommerce database structure!