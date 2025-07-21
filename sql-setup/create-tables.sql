-- nopCommerce Compatible Database Schema for KarjiStore Chatbot
-- This script creates the necessary tables to match your existing nopCommerce database structure

-- Customer Table (matches your nopCommerce Customer table structure)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Customer' and xtype='U')
CREATE TABLE Customer (
    Id int IDENTITY(1,1) PRIMARY KEY,
    CustomerGuid uniqueidentifier NOT NULL DEFAULT NEWID(),
    Username nvarchar(500) NULL,
    Email nvarchar(500) NULL,
    Password nvarchar(500) NULL,
    PasswordFormatId int NOT NULL DEFAULT 0,
    PasswordSalt nvarchar(500) NULL,
    AdminComment nvarchar(4000) NULL,
    IsTaxExempt bit NOT NULL DEFAULT 0,
    AffiliateId int NOT NULL DEFAULT 0,
    Active bit NOT NULL DEFAULT 1,
    Deleted bit NOT NULL DEFAULT 0,
    IsSystemAccount bit NOT NULL DEFAULT 0,
    SystemName nvarchar(500) NULL,
    LastIpAddress nvarchar(100) NULL,
    CreatedOnUtc datetime NOT NULL DEFAULT GETUTCDATE(),
    LastLoginDateUtc datetime NULL,
    LastActivityDateUtc datetime NOT NULL DEFAULT GETUTCDATE(),
    BillingAddress_Id int NULL,
    ShippingAddress_Id int NULL,
    Salutation nvarchar(50) NULL,
    Title nvarchar(100) NULL,
    FirstName nvarchar(225) NULL,
    LastName nvarchar(225) NULL,
    FullName nvarchar(450) NULL,
    Company nvarchar(255) NULL,
    CustomerNumber nvarchar(100) NULL
);

-- Order Table (matches your nopCommerce Order table structure)  
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Order' and xtype='U')
CREATE TABLE [Order] (
    Id int IDENTITY(1,1) PRIMARY KEY,
    OrderNumber nvarchar(4000) NULL,
    OrderGuid uniqueidentifier NOT NULL DEFAULT NEWID(),
    StoreId int NOT NULL DEFAULT 1,
    CustomerId int NOT NULL,
    BillingAddressId int NULL,
    ShippingAddressId int NULL,
    OrderStatusId int NOT NULL DEFAULT 10,
    ShippingStatusId int NOT NULL DEFAULT 10,
    PaymentStatusId int NOT NULL DEFAULT 10,
    PaymentMethodSystemName nvarchar(4000) NULL,
    CustomerCurrencyCode nvarchar(4000) NULL,
    CurrencyRate decimal(18,8) NOT NULL DEFAULT 1,
    CustomerTaxDisplayTypeId int NOT NULL DEFAULT 0,
    VatNumber nvarchar(4000) NULL,
    OrderSubtotalInclTax decimal(18,4) NOT NULL DEFAULT 0,
    OrderSubtotalExclTax decimal(18,4) NOT NULL DEFAULT 0,
    OrderSubTotalDiscountInclTax decimal(18,4) NOT NULL DEFAULT 0,
    OrderSubTotalDiscountExclTax decimal(18,4) NOT NULL DEFAULT 0,
    OrderShippingInclTax decimal(18,4) NOT NULL DEFAULT 0,
    OrderShippingExclTax decimal(18,4) NOT NULL DEFAULT 0,
    OrderShippingTaxRate decimal(18,4) NOT NULL DEFAULT 0,
    PaymentMethodAdditionalFeeInclTax decimal(18,4) NOT NULL DEFAULT 0,
    PaymentMethodAdditionalFeeExclTax decimal(18,4) NOT NULL DEFAULT 0,
    PaymentMethodAdditionalFeeTaxRate decimal(18,4) NOT NULL DEFAULT 0,
    TaxRates nvarchar(4000) NULL,
    OrderTax decimal(18,4) NOT NULL DEFAULT 0,
    OrderDiscount decimal(18,4) NOT NULL DEFAULT 0,
    OrderTotal decimal(18,4) NOT NULL DEFAULT 0,
    RefundedAmount decimal(18,4) NOT NULL DEFAULT 0,
    RewardPointsWereAdded bit NOT NULL DEFAULT 0,
    CheckoutAttributeDescription nvarchar(4000) NULL,
    CheckoutAttributesXml nvarchar(4000) NULL,
    CustomerLanguageId int NOT NULL DEFAULT 1,
    AffiliateId int NOT NULL DEFAULT 0,
    CustomerIp nvarchar(100) NULL,
    AllowStoringCreditCardNumber bit NOT NULL DEFAULT 0,
    CardType nvarchar(100) NULL,
    CardName nvarchar(100) NULL,
    CardNumber nvarchar(100) NULL,
    MaskedCreditCardNumber nvarchar(100) NULL,
    CardCvv2 nvarchar(100) NULL,
    CardExpirationMonth nvarchar(100) NULL,
    CardExpirationYear nvarchar(100) NULL,
    PaymentMethodSystemName nvarchar(4000) NULL,
    AuthorizationTransactionId nvarchar(4000) NULL,
    AuthorizationTransactionCode nvarchar(4000) NULL,
    AuthorizationTransactionResult nvarchar(4000) NULL,
    CaptureTransactionId nvarchar(4000) NULL,
    CaptureTransactionResult nvarchar(4000) NULL,
    SubscriptionTransactionId nvarchar(4000) NULL,
    PaidDateUtc datetime NULL,
    ShippingMethod nvarchar(100) NULL,
    ShippingRateComputationMethodSystemName nvarchar(100) NULL,
    CustomValuesXml nvarchar(4000) NULL,
    Deleted bit NOT NULL DEFAULT 0,
    CreatedOnUtc datetime NOT NULL DEFAULT GETUTCDATE(),
    FOREIGN KEY (CustomerId) REFERENCES Customer(Id)
);

-- OrderNote Table (matches your nopCommerce OrderNote table structure)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='OrderNote' and xtype='U') 
CREATE TABLE OrderNote (
    Id int IDENTITY(1,1) PRIMARY KEY,
    OrderId int NOT NULL,
    Note nvarchar(max) NOT NULL,
    DisplayToCustomer bit NOT NULL DEFAULT 0,
    CreatedOnUtc datetime NOT NULL DEFAULT GETUTCDATE(),
    FOREIGN KEY (OrderId) REFERENCES [Order](Id)
);

-- Optional: ChatMessage table for storing chatbot conversations
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ChatMessage' and xtype='U')
CREATE TABLE ChatMessage (
    Id int IDENTITY(1,1) PRIMARY KEY,
    SessionId nvarchar(100) NOT NULL,
    Content nvarchar(max) NOT NULL,
    IsBot bit NOT NULL DEFAULT 0,
    CreatedOnUtc datetime NOT NULL DEFAULT GETUTCDATE()
);

-- Create indexes for better performance
CREATE NONCLUSTERED INDEX IX_Customer_Email ON Customer (Email);
CREATE NONCLUSTERED INDEX IX_Customer_Deleted ON Customer (Deleted);
CREATE NONCLUSTERED INDEX IX_Order_CustomerId ON [Order] (CustomerId);
CREATE NONCLUSTERED INDEX IX_Order_OrderNumber ON [Order] (OrderNumber);
CREATE NONCLUSTERED INDEX IX_OrderNote_OrderId ON OrderNote (OrderId);
CREATE NONCLUSTERED INDEX IX_OrderNote_DisplayToCustomer ON OrderNote (DisplayToCustomer);
CREATE NONCLUSTERED INDEX IX_ChatMessage_SessionId ON ChatMessage (SessionId);

PRINT 'nopCommerce compatible tables created successfully!';