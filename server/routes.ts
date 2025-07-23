import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { storage } from "./storage";
import { orderTrackingSchema, chatMessageSchema } from "@shared/schema";
import { isDatabaseConfigured, mssqlConfig, databaseType } from "./config";
import { registerAdminRoutes } from "./routes/admin";
import { ragService } from "./services/rag-service";
import { vectorStorage } from "./services/vector-storage";
import { aiService } from "./services/ai-service";
import { schedulerService } from "./services/scheduler";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize services
  try {
    await vectorStorage.initialize();
    await schedulerService.initialize();
    
    // Load AI configuration if available
    const aiConfig = await vectorStorage.getAiConfig();
    if (aiConfig) {
      aiService.setProvider(aiConfig);
      console.log('✓ AI service initialized with saved configuration');
    }
  } catch (error) {
    console.error('⚠️ Warning: Failed to initialize some services:', error);
  }

  // Register admin routes
  registerAdminRoutes(app);
  
  // Database status endpoint
  app.get("/api/status", async (req, res) => {
    try {
      const vectorStats = await vectorStorage.getStats();
      const aiConfig = await vectorStorage.getAiConfig();
      
      res.json({
        database: {
          configured: isDatabaseConfigured,
          server: mssqlConfig.server || 'Not configured',
          database: mssqlConfig.database,
          type: isDatabaseConfigured ? 'MSSQL' : 'Mock Data'
        },
        vectorStorage: {
          initialized: true,
          stats: vectorStats
        },
        aiProvider: {
          configured: !!aiConfig,
          provider: aiConfig?.provider || 'none',
          active: aiConfig?.isActive || false
        },
        version: "1.0.0",
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.json({
        database: {
          configured: isDatabaseConfigured,
          server: mssqlConfig.server || 'Not configured',
          database: mssqlConfig.database,
          type: isDatabaseConfigured ? 'MSSQL' : 'Mock Data'
        },
        vectorStorage: {
          initialized: false,
          error: error?.message || 'Unknown error'
        },
        version: "1.0.0",
        timestamp: new Date().toISOString()
      });
    }
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

  // AI Chat endpoint
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

      const { sessionId, content, isBot } = validationResult.data;
      
      // Check if AI provider is configured and active
      const aiConfigured = await vectorStorage.getAiConfig();
      if (!aiConfigured || !aiConfigured.isActive) {
        return res.status(503).json({
          error: "AI provider not configured",
          message: "AI assistant is not available. Please configure an AI provider in the admin dashboard."
        });
      }
      
      // Save user message to vector storage
      if (!isBot) {
        await vectorStorage.saveChatMessage(sessionId, {
          content,
          isBot: false
        });
      }

      // Always run through RAG pipeline for all queries
      const ragResponse = await ragService.query(content, sessionId);
      
      // Save bot response to vector storage
      await vectorStorage.saveChatMessage(sessionId, {
        content: ragResponse.answer,
        isBot: true
      });

      res.json({
        message: ragResponse.answer,
        sources: ragResponse.sources,
        confidence: ragResponse.confidence,
        type: 'ai_response'
      });
    } catch (error: any) {
      console.error('Chat Error:', error);
      const errorResponse = "I apologize, but I'm experiencing some technical difficulties. Please try again in a moment.";
      
      // Still try to save the error response
      try {
        if (req.body.sessionId) {
          await vectorStorage.saveChatMessage(req.body.sessionId, {
            content: errorResponse,
            isBot: true
          });
        }
      } catch (saveError) {
        console.error('Failed to save error response:', saveError);
      }
      
      res.status(500).json({ 
        message: errorResponse,
        error: "Chat service temporarily unavailable" 
      });
    }
  });

  // Get chat history
  app.get("/api/chat/history/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const history = await vectorStorage.getChatHistory(sessionId);
      
      res.json(history.map(msg => ({
        content: msg.content,
        isBot: msg.isBot,
        timestamp: msg.timestamp
      })));
    } catch (error) {
      console.error('Error getting chat history:', error);
      res.status(500).json({ error: "Failed to get chat history" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
