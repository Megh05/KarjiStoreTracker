-- Sample Data for Testing KarjiStore Chatbot Order Tracking
-- This script inserts test data that matches nopCommerce structure

-- Insert sample customers
INSERT INTO Customer (
    CustomerGuid, Username, Email, FirstName, LastName, FullName, 
    Company, CustomerNumber, Active, Deleted, CreatedOnUtc, LastActivityDateUtc
) VALUES 
(NEWID(), 'john.doe@example.com', 'john.doe@example.com', 'John', 'Doe', 'John Doe', 
 'Tech Solutions Inc', 'CUST001', 1, 0, GETUTCDATE(), GETUTCDATE()),
 
(NEWID(), 'jane.smith@example.com', 'jane.smith@example.com', 'Jane', 'Smith', 'Jane Smith', 
 'Design Studio LLC', 'CUST002', 1, 0, GETUTCDATE(), GETUTCDATE()),
 
(NEWID(), 'mike.johnson@example.com', 'mike.johnson@example.com', 'Mike', 'Johnson', 'Mike Johnson', 
 NULL, 'CUST003', 1, 0, GETUTCDATE(), GETUTCDATE());

-- Insert sample orders
DECLARE @CustomerId1 int = (SELECT Id FROM Customer WHERE Email = 'john.doe@example.com');
DECLARE @CustomerId2 int = (SELECT Id FROM Customer WHERE Email = 'jane.smith@example.com');
DECLARE @CustomerId3 int = (SELECT Id FROM Customer WHERE Email = 'mike.johnson@example.com');

INSERT INTO [Order] (
    OrderNumber, OrderGuid, CustomerId, OrderStatusId, ShippingStatusId, PaymentStatusId,
    OrderSubtotalInclTax, OrderShippingInclTax, OrderTotal, PaymentMethodSystemName,
    CreatedOnUtc
) VALUES 
-- Completed order for John Doe
('ORD-2024-001', NEWID(), @CustomerId1, 30, 30, 25, 299.99, 15.00, 314.99, 'PayPal', DATEADD(day, -7, GETUTCDATE())),

-- Processing order for Jane Smith  
('ORD-2024-002', NEWID(), @CustomerId2, 20, 10, 25, 159.99, 10.00, 169.99, 'Credit Card', DATEADD(day, -2, GETUTCDATE())),

-- Shipped order for Mike Johnson
('ORD-2024-003', NEWID(), @CustomerId3, 20, 25, 25, 89.99, 8.50, 98.49, 'Stripe', DATEADD(day, -4, GETUTCDATE()));

-- Insert order notes for tracking timeline
DECLARE @OrderId1 int = (SELECT Id FROM [Order] WHERE OrderNumber = 'ORD-2024-001');
DECLARE @OrderId2 int = (SELECT Id FROM [Order] WHERE OrderNumber = 'ORD-2024-002'); 
DECLARE @OrderId3 int = (SELECT Id FROM [Order] WHERE OrderNumber = 'ORD-2024-003');

-- Order 1 timeline (John Doe - Completed)
INSERT INTO OrderNote (OrderId, Note, DisplayToCustomer, CreatedOnUtc) VALUES
(@OrderId1, 'Order received and payment confirmed', 1, DATEADD(day, -7, GETUTCDATE())),
(@OrderId1, 'Items picked from warehouse and ready for packing', 1, DATEADD(day, -6, DATEADD(hour, 2, GETUTCDATE()))),
(@OrderId1, 'Order packed and labeled for shipping', 1, DATEADD(day, -6, DATEADD(hour, 8, GETUTCDATE()))),
(@OrderId1, 'Package shipped via UPS - Tracking: 1Z999AA1234567890', 1, DATEADD(day, -5, DATEADD(hour, 10, GETUTCDATE()))),
(@OrderId1, 'Package out for delivery', 1, DATEADD(day, -3, DATEADD(hour, 9, GETUTCDATE()))),
(@OrderId1, 'Package delivered successfully - Signed by John D.', 1, DATEADD(day, -3, DATEADD(hour, 15, GETUTCDATE())));

-- Order 2 timeline (Jane Smith - Processing)
INSERT INTO OrderNote (OrderId, Note, DisplayToCustomer, CreatedOnUtc) VALUES
(@OrderId2, 'Order received and payment processed', 1, DATEADD(day, -2, GETUTCDATE())),
(@OrderId2, 'Order being processed - Inventory check complete', 1, DATEADD(day, -2, DATEADD(hour, 4, GETUTCDATE()))),
(@OrderId2, 'Items being picked from warehouse', 1, DATEADD(day, -1, DATEADD(hour, 10, GETUTCDATE())));

-- Order 3 timeline (Mike Johnson - Shipped)
INSERT INTO OrderNote (OrderId, Note, DisplayToCustomer, CreatedOnUtc) VALUES
(@OrderId3, 'Order confirmed and payment authorized', 1, DATEADD(day, -4, GETUTCDATE())),
(@OrderId3, 'Items picked and packed for shipping', 1, DATEADD(day, -3, DATEADD(hour, 6, GETUTCDATE()))),
(@OrderId3, 'Package shipped via FedEx - Tracking: 1234567890123456', 1, DATEADD(day, -2, DATEADD(hour, 14, GETUTCDATE()))),
(@OrderId3, 'Package in transit - Expected delivery tomorrow', 1, DATEADD(day, -1, DATEADD(hour, 8, GETUTCDATE())));

PRINT 'Sample data inserted successfully!';
PRINT 'Test with:';
PRINT '  Email: john.doe@example.com, Order: ORD-2024-001 (Delivered)';  
PRINT '  Email: jane.smith@example.com, Order: ORD-2024-002 (Processing)';
PRINT '  Email: mike.johnson@example.com, Order: ORD-2024-003 (Shipped)';