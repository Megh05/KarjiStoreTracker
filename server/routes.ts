import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { storage } from "./storage";
import { orderTrackingSchema, chatMessageSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
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

      // Get the latest status from order notes
      const latestNote = order.orderNotes[0]; // Notes are ordered by CreatedOnUtc DESC
      const currentStatus = latestNote ? latestNote.note : "Order placed";
      
      // Create order timeline from notes
      const timeline = order.orderNotes.reverse().map((note, index) => ({
        id: note.id,
        status: note.note,
        date: note.createdOnUtc,
        completed: true,
        isLatest: index === order.orderNotes.length - 1
      }));

      // Add standard order statuses if not present
      const standardStatuses = [
        "Order placed",
        "Payment confirmed", 
        "Order processing",
        "Shipped",
        "Out for delivery",
        "Delivered"
      ];

      const timelineStatuses = timeline.map(t => t.status);
      const missingStatuses = standardStatuses.filter(status => 
        !timelineStatuses.some(ts => ts.toLowerCase().includes(status.toLowerCase()))
      );

      // Add missing future statuses as pending
      missingStatuses.forEach(status => {
        timeline.push({
          id: 0,
          status,
          date: null,
          completed: false,
          isLatest: false
        });
      });

      const response = {
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          orderDate: order.createdOnUtc,
          status: currentStatus,
          customer: {
            name: order.customer.fullName || `${order.customer.firstName} ${order.customer.lastName}`.trim(),
            email: order.customer.email
          }
        },
        timeline,
        latestUpdate: latestNote ? {
          status: latestNote.note,
          date: latestNote.createdOnUtc
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
