import sql from 'mssql';
import { customers, orders, orderNotes, chatMessages, type Customer, type Order, type OrderNote, type ChatMessage, type OrderWithDetails, type InsertChatMessage } from "@shared/schema";
import { mssqlConfig, isDatabaseConfigured } from "./config";

// Mock data for demonstration
const mockCustomers: Customer[] = [
  {
    id: 1,
    customerGuid: "cust-guid-001",
    username: "john_doe",
    email: "john.doe@example.com",
    password: "",
    firstName: "John",
    lastName: "Doe",
    fullName: "John Doe",
    company: "Tech Solutions Inc",
    customerNumber: "CUST001",
    createdOnUtc: new Date('2024-01-15'),
    lastLoginDateUtc: new Date('2024-04-08'),
    lastActivityDateUtc: new Date('2024-04-08'),
    active: true,
    deleted: false,
  },
  {
    id: 2,
    customerGuid: "cust-guid-002", 
    username: "jane_smith",
    email: "jane.smith@company.com",
    password: "",
    firstName: "Jane",
    lastName: "Smith",
    fullName: "Jane Smith",
    company: "Marketing Pro",
    customerNumber: "CUST002",
    createdOnUtc: new Date('2024-02-01'),
    lastLoginDateUtc: new Date('2024-04-07'),
    lastActivityDateUtc: new Date('2024-04-07'),
    active: true,
    deleted: false,
  }
];

const mockOrders: Order[] = [
  {
    id: 1,
    orderNumber: "ORD-2024-001",
    orderGuid: "order-guid-001",
    storeId: 1,
    customerId: 1,
    orderStatusId: 3,
    shippingStatusId: 2,
    paymentStatusId: 2,
    customerCurrencyCode: "USD",
    currencyRate: "1.00",
    vatNumber: null,
    orderSubtotalInclTax: "299.99",
    orderSubtotalExclTax: "249.99",
    orderSubTotalDiscountInclTax: "0.00",
    orderSubTotalDiscountExclTax: "0.00", 
    orderShippingInclTax: "15.99",
    orderShippingExclTax: "15.99",
    paymentMethodSystemName: "CreditCard",
    createdOnUtc: new Date('2024-04-03'),
  },
  {
    id: 2,
    orderNumber: "ORD-2024-002",
    orderGuid: "order-guid-002",
    storeId: 1,
    customerId: 2,
    orderStatusId: 4,
    shippingStatusId: 3,
    paymentStatusId: 2,
    customerCurrencyCode: "USD",
    currencyRate: "1.00",
    vatNumber: null,
    orderSubtotalInclTax: "149.99",
    orderSubtotalExclTax: "124.99",
    orderSubTotalDiscountInclTax: "0.00",
    orderSubTotalDiscountExclTax: "0.00",
    orderShippingInclTax: "9.99", 
    orderShippingExclTax: "9.99",
    paymentMethodSystemName: "PayPal",
    createdOnUtc: new Date('2024-04-05'),
  }
];

const mockOrderNotes: OrderNote[] = [
  {
    id: 1,
    orderId: 1,
    note: "Order placed",
    displayToCustomer: true,
    createdOnUtc: new Date('2024-04-03 10:32:49'),
  },
  {
    id: 2,
    orderId: 1,
    note: "Payment confirmed",
    displayToCustomer: true,
    createdOnUtc: new Date('2024-04-03 10:35:12'),
  },
  {
    id: 3,
    orderId: 1,
    note: "Order processing",
    displayToCustomer: true,
    createdOnUtc: new Date('2024-04-04 09:15:30'),
  },
  {
    id: 4,
    orderId: 1,
    note: "Shipped via FedEx - Tracking: 123456789",
    displayToCustomer: true,
    createdOnUtc: new Date('2024-04-05 06:42:04'),
  },
  {
    id: 5,
    orderId: 2,
    note: "Order placed",
    displayToCustomer: true,
    createdOnUtc: new Date('2024-04-05 06:42:09'),
  },
  {
    id: 6,
    orderId: 2,
    note: "Payment confirmed",
    displayToCustomer: true,
    createdOnUtc: new Date('2024-04-05 06:42:15'),
  },
  {
    id: 7,
    orderId: 2,
    note: "Order processing",
    displayToCustomer: true,
    createdOnUtc: new Date('2024-04-06 14:20:30'),
  },
  {
    id: 8,
    orderId: 2,
    note: "Shipped via UPS - Tracking: 987654321",
    displayToCustomer: true,
    createdOnUtc: new Date('2024-04-07 11:45:22'),
  },
  {
    id: 9,
    orderId: 2,
    note: "Out for delivery",
    displayToCustomer: true,
    createdOnUtc: new Date('2024-04-08 07:11:38'),
  }
];

let mockChatMessages: ChatMessage[] = [];

export interface IStorage {
  // Order tracking methods
  getOrderByIdAndEmail(orderId: string, email: string): Promise<OrderWithDetails | undefined>;
  getOrderNotesByOrderId(orderId: number): Promise<OrderNote[]>;
  
  // Chat methods
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  getChatMessagesBySession(sessionId: string): Promise<ChatMessage[]>;
  
  // Customer methods
  getCustomerByEmail(email: string): Promise<Customer | undefined>;
}

// Mock Storage for development - replace with MSSQLStorage when database is available
export class MockStorage implements IStorage {
  constructor() {
    console.log('Using mock storage for development');
  }

  async getOrderByIdAndEmail(orderId: string, email: string): Promise<OrderWithDetails | undefined> {
    // Find customer by email
    const customer = mockCustomers.find(c => c.email.toLowerCase() === email.toLowerCase());
    if (!customer) {
      return undefined;
    }

    // Find order by order number or ID for this customer
    const order = mockOrders.find(o => 
      (o.orderNumber === orderId || o.id.toString() === orderId) && 
      o.customerId === customer.id
    );
    
    if (!order) {
      return undefined;
    }

    // Get order notes for this order (sorted by date DESC)
    const orderNotes = mockOrderNotes
      .filter(note => note.orderId === order.id && note.displayToCustomer)
      .sort((a, b) => (b.createdOnUtc?.getTime() || 0) - (a.createdOnUtc?.getTime() || 0));

    const orderWithDetails: OrderWithDetails = {
      ...order,
      customer,
      orderNotes
    };

    return orderWithDetails;
  }

  async getOrderNotesByOrderId(orderId: number): Promise<OrderNote[]> {
    return mockOrderNotes
      .filter(note => note.orderId === orderId && note.displayToCustomer)
      .sort((a, b) => (b.createdOnUtc?.getTime() || 0) - (a.createdOnUtc?.getTime() || 0));
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const newMessage: ChatMessage = {
      id: mockChatMessages.length + 1,
      sessionId: message.sessionId,
      content: message.content,
      isBot: message.isBot ?? false,
      createdOnUtc: new Date(),
    };
    
    mockChatMessages.push(newMessage);
    return newMessage;
  }

  async getChatMessagesBySession(sessionId: string): Promise<ChatMessage[]> {
    return mockChatMessages
      .filter(msg => msg.sessionId === sessionId)
      .sort((a, b) => (a.createdOnUtc?.getTime() || 0) - (b.createdOnUtc?.getTime() || 0));
  }

  async getCustomerByEmail(email: string): Promise<Customer | undefined> {
    return mockCustomers.find(c => c.email.toLowerCase() === email.toLowerCase() && !c.deleted);
  }
}

// For production MSSQL implementation when database connection is available
export class MSSQLStorage implements IStorage {
  private pool: sql.ConnectionPool | null = null;

  constructor() {
    this.initializeConnection();
  }

  private async initializeConnection() {
    try {
      this.pool = new sql.ConnectionPool(mssqlConfig);
      await this.pool.connect();
      console.log('✅ Connected to MSSQL database successfully');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }
  }

  private async ensureConnection() {
    if (!this.pool || !this.pool.connected) {
      await this.initializeConnection();
    }
  }

  async getOrderByIdAndEmail(orderId: string, email: string): Promise<OrderWithDetails | undefined> {
    await this.ensureConnection();
    
    try {
      const request = this.pool!.request();
      request.input('orderId', sql.NVarChar, orderId);
      request.input('email', sql.NVarChar, email);
      
      const result = await request.query(`
        SELECT 
          o.*,
          c.Id as customer_id,
          c.CustomerGuid,
          c.Username,
          c.Email,
          c.FirstName,
          c.LastName,
          c.FullName,
          c.Company,
          c.CustomerNumber,
          c.Active,
          c.Deleted
        FROM dbo.[Order] o
        INNER JOIN dbo.Customer c ON o.CustomerId = c.Id
        WHERE (o.Id = @orderId OR o.OrderNumber = @orderId)
          AND c.Email = @email
          AND c.Deleted = 0
      `);

      if (result.recordset.length === 0) {
        return undefined;
      }

      const orderData = result.recordset[0];
      const orderNotes = await this.getOrderNotesByOrderId(orderData.Id);
      
      const order: OrderWithDetails = {
        id: orderData.Id,
        orderNumber: orderData.OrderNumber,
        orderGuid: orderData.OrderGuid,
        storeId: orderData.StoreId,
        customerId: orderData.CustomerId,
        orderStatusId: orderData.OrderStatusId,
        shippingStatusId: orderData.ShippingStatusId,
        paymentStatusId: orderData.PaymentStatusId,
        customerCurrencyCode: orderData.CustomerCurrencyCode,
        currencyRate: orderData.CurrencyRate,
        vatNumber: orderData.VatNumber,
        orderSubtotalInclTax: orderData.OrderSubtotalInclTax,
        orderSubtotalExclTax: orderData.OrderSubtotalExclTax,
        orderSubTotalDiscountInclTax: orderData.OrderSubTotalDiscountInclTax,
        orderSubTotalDiscountExclTax: orderData.OrderSubTotalDiscountExclTax,
        orderShippingInclTax: orderData.OrderShippingInclTax,
        orderShippingExclTax: orderData.OrderShippingExclTax,
        paymentMethodSystemName: orderData.PaymentMethodSystemName,
        createdOnUtc: orderData.CreatedOnUtc,
        customer: {
          id: orderData.customer_id,
          customerGuid: orderData.CustomerGuid,
          username: orderData.Username,
          email: orderData.Email,
          password: '',
          firstName: orderData.FirstName,
          lastName: orderData.LastName,
          fullName: orderData.FullName,
          company: orderData.Company,
          customerNumber: orderData.CustomerNumber,
          createdOnUtc: orderData.CreatedOnUtc,
          lastLoginDateUtc: orderData.LastLoginDateUtc,
          lastActivityDateUtc: orderData.LastActivityDateUtc,
          active: orderData.Active,
          deleted: orderData.Deleted,
        },
        orderNotes
      };

      return order;
    } catch (error) {
      console.error('Error getting order:', error);
      throw new Error('Failed to retrieve order information');
    }
  }

  async getOrderNotesByOrderId(orderId: number): Promise<OrderNote[]> {
    await this.ensureConnection();
    
    try {
      const request = this.pool!.request();
      request.input('orderId', sql.Int, orderId);
      
      const result = await request.query(`
        SELECT *
        FROM dbo.OrderNote
        WHERE OrderId = @orderId
          AND DisplayToCustomer = 1
        ORDER BY CreatedOnUtc DESC
      `);

      return result.recordset.map(record => ({
        id: record.Id,
        orderId: record.OrderId,
        note: record.Note,
        displayToCustomer: record.DisplayToCustomer,
        createdOnUtc: record.CreatedOnUtc,
      }));
    } catch (error) {
      console.error('Error getting order notes:', error);
      throw new Error('Failed to retrieve order notes');
    }
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    await this.ensureConnection();
    
    try {
      const request = this.pool!.request();
      request.input('sessionId', sql.NVarChar, message.sessionId);
      request.input('content', sql.NVarChar, message.content);
      request.input('isBot', sql.Bit, message.isBot);
      
      const result = await request.query(`
        INSERT INTO ChatMessage (SessionId, Content, IsBot, CreatedOnUtc)
        OUTPUT INSERTED.*
        VALUES (@sessionId, @content, @isBot, GETUTCDATE())
      `);

      const record = result.recordset[0];
      return {
        id: record.Id,
        sessionId: record.SessionId,
        content: record.Content,
        isBot: record.IsBot,
        createdOnUtc: record.CreatedOnUtc,
      };
    } catch (error) {
      console.error('Error creating chat message:', error);
      throw new Error('Failed to save chat message');
    }
  }

  async getChatMessagesBySession(sessionId: string): Promise<ChatMessage[]> {
    await this.ensureConnection();
    
    try {
      const request = this.pool!.request();
      request.input('sessionId', sql.NVarChar, sessionId);
      
      const result = await request.query(`
        SELECT *
        FROM ChatMessage
        WHERE SessionId = @sessionId
        ORDER BY CreatedOnUtc ASC
      `);

      return result.recordset.map(record => ({
        id: record.Id,
        sessionId: record.SessionId,
        content: record.Content,
        isBot: record.IsBot,
        createdOnUtc: record.CreatedOnUtc,
      }));
    } catch (error) {
      console.error('Error getting chat messages:', error);
      throw new Error('Failed to retrieve chat messages');
    }
  }

  async getCustomerByEmail(email: string): Promise<Customer | undefined> {
    await this.ensureConnection();
    
    try {
      const request = this.pool!.request();
      request.input('email', sql.NVarChar, email);
      
      const result = await request.query(`
        SELECT *
        FROM dbo.Customer
        WHERE Email = @email AND Deleted = 0
      `);

      if (result.recordset.length === 0) {
        return undefined;
      }

      const record = result.recordset[0];
      return {
        id: record.Id,
        customerGuid: record.CustomerGuid,
        username: record.Username,
        email: record.Email,
        password: '',
        firstName: record.FirstName,
        lastName: record.LastName,
        fullName: record.FullName,
        company: record.Company,
        customerNumber: record.CustomerNumber,
        createdOnUtc: record.CreatedOnUtc,
        lastLoginDateUtc: record.LastLoginDateUtc,
        lastActivityDateUtc: record.LastActivityDateUtc,
        active: record.Active,
        deleted: record.Deleted,
      };
    } catch (error) {
      console.error('Error getting customer:', error);
      throw new Error('Failed to retrieve customer information');
    }
  }
}

// Export storage instance - using mock data for development
export const storage = new MockStorage();
