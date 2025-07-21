import { pgTable, text, serial, integer, boolean, timestamp, decimal, uniqueIdentifier } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Customer table based on the database structure
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  customerGuid: text("customer_guid").notNull().unique(),
  username: text("username"),
  email: text("email").notNull(),
  password: text("password"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  fullName: text("full_name"),
  company: text("company"),
  customerNumber: text("customer_number"),
  createdOnUtc: timestamp("created_on_utc").defaultNow(),
  lastLoginDateUtc: timestamp("last_login_date_utc"),
  lastActivityDateUtc: timestamp("last_activity_date_utc"),
  active: boolean("active").default(true),
  deleted: boolean("deleted").default(false),
});

// Order table based on the database structure
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  orderGuid: text("order_guid").notNull().unique(),
  storeId: integer("store_id").default(1),
  customerId: integer("customer_id").references(() => customers.id),
  orderStatusId: integer("order_status_id").default(1),
  shippingStatusId: integer("shipping_status_id").default(1),
  paymentStatusId: integer("payment_status_id").default(1),
  customerCurrencyCode: text("customer_currency_code").default("USD"),
  currencyRate: decimal("currency_rate", { precision: 18, scale: 8 }).default("1.00"),
  vatNumber: text("vat_number"),
  orderSubtotalInclTax: decimal("order_subtotal_incl_tax", { precision: 18, scale: 4 }).default("0.00"),
  orderSubtotalExclTax: decimal("order_subtotal_excl_tax", { precision: 18, scale: 4 }).default("0.00"),
  orderSubTotalDiscountInclTax: decimal("order_sub_total_discount_incl_tax", { precision: 18, scale: 4 }).default("0.00"),
  orderSubTotalDiscountExclTax: decimal("order_sub_total_discount_excl_tax", { precision: 18, scale: 4 }).default("0.00"),
  orderShippingInclTax: decimal("order_shipping_incl_tax", { precision: 18, scale: 4 }).default("0.00"),
  orderShippingExclTax: decimal("order_shipping_excl_tax", { precision: 18, scale: 4 }).default("0.00"),
  paymentMethodSystemName: text("payment_method_system_name"),
  createdOnUtc: timestamp("created_on_utc").defaultNow(),
});

// OrderNote table for tracking order status updates
export const orderNotes = pgTable("order_notes", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id),
  note: text("note").notNull(),
  displayToCustomer: boolean("display_to_customer").default(false),
  createdOnUtc: timestamp("created_on_utc").defaultNow(),
});

// Chat messages for storing conversation history
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  content: text("content").notNull(),
  isBot: boolean("is_bot").default(true),
  createdOnUtc: timestamp("created_on_utc").defaultNow(),
});

// Schema validations
export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdOnUtc: true,
  lastLoginDateUtc: true,
  lastActivityDateUtc: true,
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdOnUtc: true,
});

export const insertOrderNoteSchema = createInsertSchema(orderNotes).omit({
  id: true,
  createdOnUtc: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdOnUtc: true,
});

// Order tracking request schema
export const orderTrackingSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  orderId: z.string().min(1, "Please enter an order ID"),
});

// Chat message schema
export const chatMessageSchema = z.object({
  sessionId: z.string(),
  content: z.string().min(1, "Message cannot be empty"),
  isBot: z.boolean().default(false),
});

// Types
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

export type InsertOrderNote = z.infer<typeof insertOrderNoteSchema>;
export type OrderNote = typeof orderNotes.$inferSelect;

export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

export type OrderTrackingRequest = z.infer<typeof orderTrackingSchema>;
export type ChatMessageRequest = z.infer<typeof chatMessageSchema>;

// Order with related data
export type OrderWithDetails = Order & {
  customer: Customer;
  orderNotes: OrderNote[];
};

export type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";
