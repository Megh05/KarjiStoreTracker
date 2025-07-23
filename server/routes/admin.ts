import type { Express } from "express";
import { z } from "zod";
import { vectorStorage } from "../services/vector-storage";
import { aiService } from "../services/ai-service";
import { ragService } from "../services/rag-service";
import { contentParser } from "../services/content-parser";
import { schedulerService } from "../services/scheduler";
import { azureConfigSchema, ollamaConfigSchema, aiProviderConfigSchema } from "@shared/schema";
import multer from "multer";

// Configure multer for file uploads
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

export function registerAdminRoutes(app: Express) {
  // Get AI configuration
  app.get("/api/admin/ai-config", async (req, res) => {
    try {
      const config = await vectorStorage.getAiConfig();
      res.json(config || null);
    } catch (error) {
      console.error('Error getting AI config:', error);
      res.status(500).json({ error: 'Failed to get AI configuration' });
    }
  });

  // Save AI configuration
  app.post("/api/admin/ai-config", async (req, res) => {
    try {
      const validationResult = aiProviderConfigSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: validationResult.error.errors 
        });
      }

      const { provider, config, customInstructions } = validationResult.data;
      
      // Save configuration to vector storage
      const savedConfig = await vectorStorage.saveAiConfig({
        provider,
        config,
        customInstructions
      });

      // Initialize AI service with new configuration
      aiService.setProvider(savedConfig);

      res.json(savedConfig);
    } catch (error) {
      console.error('Error saving AI config:', error);
      res.status(500).json({ error: 'Failed to save AI configuration' });
    }
  });

  // Test AI connection
  app.post("/api/admin/test-connection", async (req, res) => {
    try {
      const validationResult = aiProviderConfigSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: validationResult.error.errors 
        });
      }

      const { provider, config } = validationResult.data;
      
      // Create temporary AI service instance for testing
      const tempConfig = {
        id: 0,
        provider,
        config,
        isActive: true,
        createdOnUtc: new Date(),
        updatedOnUtc: new Date()
      };
      
      const tempAiService = new (aiService.constructor as any)();
      tempAiService.setProvider(tempConfig);
      
      const isConnected = await tempAiService.testConnection();
      
      if (isConnected) {
        res.json({ success: true, message: 'Connection successful' });
      } else {
        res.status(400).json({ error: 'Connection test failed' });
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      res.status(500).json({ error: 'Failed to test connection' });
    }
  });

  // Get available Ollama models
  app.get("/api/admin/ollama-models", async (req, res) => {
    try {
      const endpoint = req.query.endpoint as string || 'http://localhost:11434';
      const models = await aiService.getOllamaModels(endpoint);
      
      const modelsWithSize = models.map(model => ({
        name: model,
        size: 'Unknown' // Ollama API doesn't always provide size info easily
      }));
      
      res.json(modelsWithSize);
    } catch (error) {
      console.error('Error getting Ollama models:', error);
      res.status(500).json({ error: 'Failed to get Ollama models' });
    }
  });

  // Knowledge base routes
  app.get("/api/admin/knowledge-base", async (req, res) => {
    try {
      const knowledgeBase = await vectorStorage.getKnowledgeBase();
      res.json(knowledgeBase);
    } catch (error) {
      console.error('Error getting knowledge base:', error);
      res.status(500).json({ error: 'Failed to get knowledge base' });
    }
  });

  app.post("/api/admin/knowledge-base", async (req, res) => {
    try {
      const { title, content, type, sourceUrl } = req.body;
      
      if (!title || !content || !type) {
        return res.status(400).json({ error: 'Title, content, and type are required' });
      }

      const documentId = await ragService.addKnowledgeDocument(
        title,
        content,
        type,
        sourceUrl
      );

      res.json({ 
        success: true, 
        documentId,
        message: 'Knowledge added successfully' 
      });
    } catch (error) {
      console.error('Error adding knowledge:', error);
      res.status(500).json({ error: 'Failed to add knowledge' });
    }
  });

  // Upload and process files
  app.post("/api/admin/upload", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { title, type } = req.body;
      const filePath = req.file.path;
      
      let parsedContent;
      
      if (req.file.mimetype === 'application/pdf') {
        parsedContent = await contentParser.parsePDF(filePath, title);
      } else {
        return res.status(400).json({ error: 'Unsupported file type' });
      }

      const documentId = await contentParser.processAndStore(parsedContent);

      res.json({ 
        success: true, 
        documentId,
        message: 'File processed and added to knowledge base' 
      });
    } catch (error) {
      console.error('Error processing upload:', error);
      res.status(500).json({ error: 'Failed to process uploaded file' });
    }
  });

  // Merchant feed routes
  app.get("/api/admin/merchant-feeds", async (req, res) => {
    try {
      const feeds = await vectorStorage.getMerchantFeeds();
      res.json(feeds);
    } catch (error) {
      console.error('Error getting merchant feeds:', error);
      res.status(500).json({ error: 'Failed to get merchant feeds' });
    }
  });

  app.post("/api/admin/merchant-feeds", async (req, res) => {
    try {
      const { name, feedUrl, syncInterval } = req.body;
      
      if (!name || !feedUrl) {
        return res.status(400).json({ error: 'Name and feed URL are required' });
      }

      const feed = await vectorStorage.addMerchantFeed({
        name,
        feedUrl,
        syncInterval: syncInterval || 10800
      });

      res.json(feed);
    } catch (error) {
      console.error('Error adding merchant feed:', error);
      res.status(500).json({ error: 'Failed to add merchant feed' });
    }
  });

  // Trigger merchant feed sync
  app.post("/api/admin/sync-feeds", async (req, res) => {
    try {
      await schedulerService.triggerMerchantFeedSync();
      res.json({ success: true, message: 'Merchant feed sync started' });
    } catch (error) {
      console.error('Error triggering feed sync:', error);
      res.status(500).json({ error: 'Failed to trigger feed sync' });
    }
  });

  // Vector storage statistics
  app.get("/api/admin/stats", async (req, res) => {
    try {
      const stats = await vectorStorage.getStats();
      res.json(stats);
    } catch (error) {
      console.error('Error getting stats:', error);
      res.status(500).json({ error: 'Failed to get statistics' });
    }
  });

  // Parse website content
  app.post("/api/admin/parse-website", async (req, res) => {
    try {
      const { url, title } = req.body;
      
      if (!url) {
        return res.status(400).json({ error: 'URL is required' });
      }

      const parsedContent = await contentParser.parseWebsite(url);
      if (title) {
        parsedContent.title = title;
      }
      
      const documentId = await contentParser.processAndStore(parsedContent);

      res.json({ 
        success: true, 
        documentId,
        title: parsedContent.title,
        message: 'Website content parsed and added to knowledge base' 
      });
    } catch (error) {
      console.error('Error parsing website:', error);
      res.status(500).json({ error: 'Failed to parse website content' });
    }
  });
}