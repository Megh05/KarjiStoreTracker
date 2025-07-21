import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { storage } from "./storage";
import { orderTrackingSchema, chatMessageSchema } from "@shared/schema";
import { isDatabaseConfigured, mssqlConfig, databaseType } from "./config";

export async function registerRoutes(app: Express): Promise<Server> {
  // Database status endpoint
  app.get("/api/status", (req, res) => {
    res.json({
      database: {
        configured: isDatabaseConfigured,
        server: mssqlConfig.server || 'Not configured',
        database: mssqlConfig.database,
        type: isDatabaseConfigured ? 'MSSQL' : 'Mock Data'
      },
      version: "1.0.0",
      timestamp: new Date().toISOString()
    });
  });
  // Track order endpoint
  app.post("/api/track-order", async (req, res) => {
    try {
      const validationResult = orderTrackingSchema.safeParse(req.body);
      if (!validationResult.success) {
        const errorMessage = fromZodError(validationResult.error).message;
        return res.status(400).json({ 
          error: "Validation failed", 
          message: errorMessage 
        });
      }

      const { email, orderId } = validationResult.data;
      
      const order = await storage.getOrderByIdAndEmail(orderId, email);
      
      if (!order) {
        return res.status(404).json({ 
          error: "Order not found", 
          message: `No order found with ID "${orderId}" for email "${email}". Please check your details and try again.` 
        });
      }

      // Map nopCommerce status IDs to readable names
      const getOrderStatus = (statusId: number): string => {
        const statusMap: Record<number, string> = {
          10: 'Pending',
          20: 'Processing',
          25: 'On Hold',
          30: 'Complete',
          40: 'Cancelled'
        };
        return statusMap[statusId] || `Status ID: ${statusId}`;
      };

      const getShippingStatus = (statusId: number): string => {
        const statusMap: Record<number, string> = {
          10: 'Not Yet Shipped',
          20: 'Partially Shipped',
          25: 'Shipped',
          30: 'Delivered'
        };
        return statusMap[statusId] || `Shipping Status ID: ${statusId}`;
      };

      // Get current order status
      const currentOrderStatus = getOrderStatus(order.orderStatusId || 10);
      const currentShippingStatus = getShippingStatus(order.shippingStatusId || 10);
      
      // Create timeline from order notes (these contain the actual progress updates)
      const timeline = order.orderNotes.map((note, index) => ({
        id: note.id,
        status: note.note,
        date: note.createdOnUtc?.toISOString() || new Date().toISOString(),
        completed: true,
        isLatest: index === order.orderNotes.length - 1
      }));

      // Add current status if no notes exist
      if (timeline.length === 0) {
        timeline.push({
          id: 0,
          status: `Order ${currentOrderStatus}`,
          date: order.createdOnUtc?.toISOString() || new Date().toISOString(),
          completed: true,
          isLatest: true
        });
      }

      // Get the most relevant current status
      const currentStatus = timeline.length > 0 
        ? timeline[timeline.length - 1].status 
        : currentOrderStatus;

      // Get the latest order note for latestUpdate
      const latestNote = order.orderNotes.length > 0 
        ? order.orderNotes[order.orderNotes.length - 1] 
        : null;

      const response = {
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          orderDate: order.createdOnUtc || new Date(),
          status: currentStatus,
          customer: {
            name: order.customer.fullName || `${order.customer.firstName} ${order.customer.lastName}`.trim(),
            email: order.customer.email
          }
        },
        timeline,
        latestUpdate: latestNote ? {
          status: latestNote.note,
          date: latestNote.createdOnUtc?.toISOString() || new Date().toISOString()
        } : null
      };

      res.json(response);
    } catch (error) {
      console.error("Order tracking error:", error);
      res.status(500).json({ 
        error: "Internal server error", 
        message: "Unable to track order at this time. Please try again later." 
      });
    }
  });

  // Chat message endpoint
  app.post("/api/chat/message", async (req, res) => {
    try {
      const validationResult = chatMessageSchema.safeParse(req.body);
      if (!validationResult.success) {
        const errorMessage = fromZodError(validationResult.error).message;
        return res.status(400).json({ 
          error: "Validation failed", 
          message: errorMessage 
        });
      }

      const messageData = validationResult.data;
      const savedMessage = await storage.createChatMessage(messageData);

      res.json(savedMessage);
    } catch (error) {
      console.error("Chat message error:", error);
      res.status(500).json({ 
        error: "Internal server error", 
        message: "Unable to save message at this time." 
      });
    }
  });

  // Get chat history endpoint
  app.get("/api/chat/history/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const messages = await storage.getChatMessagesBySession(sessionId);
      res.json(messages);
    } catch (error) {
      console.error("Chat history error:", error);
      res.status(500).json({ 
        error: "Internal server error", 
        message: "Unable to retrieve chat history at this time." 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
