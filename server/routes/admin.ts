import type { Express } from "express";
import { z } from "zod";
import { vectorStorage } from "../services/vector-storage";
import { aiService } from "../services/ai-service";
import { agenticRagService } from "../services/agentic-rag-service";
import { contentParser } from "../services/content-parser";
import { schedulerService } from "../services/scheduler";
import { azureConfigSchema, ollamaConfigSchema, openRouterConfigSchema, aiProviderConfigSchema, AzureConfig, OllamaConfig, OpenRouterConfig } from "@shared/schema";
import multer from "multer";

// Use the agentic RAG service for all operations
const ragService = agenticRagService;

// Configure multer for file uploads
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Default Ollama endpoint
const DEFAULT_OLLAMA_ENDPOINT = 'http://127.0.0.1:11434';

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
      console.log("Received AI config save request for provider:", req.body.provider);
      console.log("Request body:", JSON.stringify({
        provider: req.body.provider,
        config: req.body.provider === 'openrouter' ? {
          apiKey: req.body.config?.apiKey ? `${req.body.config.apiKey.substring(0, 10)}...` : 'empty',
          apiKeyLength: req.body.config?.apiKey ? req.body.config.apiKey.length : 0,
          model: req.body.config?.model
        } : '...',
        customInstructions: req.body.customInstructions ? 'present' : 'none'
      }));
      
      // Debug: Log the raw request body for OpenRouter
      if (req.body.provider === 'openrouter') {
        console.log("Raw OpenRouter config received:", {
          apiKey: req.body.config?.apiKey || 'undefined',
          apiKeyLength: req.body.config?.apiKey ? req.body.config.apiKey.length : 0,
          apiKeyFullValue: req.body.config?.apiKey, // Log the full value for debugging
          model: req.body.config?.model || 'undefined'
        });
      }
      
      const validationResult = aiProviderConfigSchema.safeParse(req.body);
      if (!validationResult.success) {
        console.error("Validation failed:", validationResult.error.errors);
        return res.status(400).json({ 
          error: "Validation failed", 
          details: validationResult.error.errors 
        });
      }

      const { provider, config, customInstructions } = validationResult.data;
      
      // Log the validated data
      console.log("Validated AI config for provider:", provider);
      
      if (provider === 'openrouter') {
        // ALWAYS use the raw API key from the request body, bypassing all validation
        (config as any).apiKey = req.body.config?.apiKey;
        
        const openRouterConfig = config as any;
        
        // Log the API key details but don't validate
        console.log("OpenRouter API key (directly from request):", {
          apiKeyExists: req.body.config?.apiKey !== undefined,
          apiKeyValue: req.body.config?.apiKey,
          apiKeyType: typeof req.body.config?.apiKey
        });
        
        console.log("OpenRouter model:", openRouterConfig.model);
      }
      
      // Save configuration to vector storage
      const savedConfig = await vectorStorage.saveAiConfig({
        provider,
        config,
        customInstructions
      });

      // Log the saved config
      console.log("Saved AI config for provider:", savedConfig.provider);
      
      if (savedConfig.provider === 'openrouter') {
        const savedOpenRouterConfig = savedConfig.config as OpenRouterConfig;
        console.log("Saved OpenRouter config has API key:", !!savedOpenRouterConfig.apiKey);
        console.log("Saved OpenRouter model:", savedOpenRouterConfig.model);
      }
      
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
      
      // Validate required fields based on provider
      if (provider === 'azure') {
        const azureConfig = config as AzureConfig & { deploymentName: string };
        if (!azureConfig.endpoint || !azureConfig.apiKey || !azureConfig.deploymentName) {
          return res.status(400).json({ 
            error: "Missing required Azure configuration", 
            details: "Endpoint URL, API Key, and Deployment Name are required" 
          });
        }
      }
      
      if (provider === 'ollama') {
        const ollamaConfig = config as OllamaConfig;
        if (!ollamaConfig.endpoint || !ollamaConfig.model) {
          return res.status(400).json({ 
            error: "Missing required Ollama configuration", 
            details: "Endpoint URL and Model are required" 
          });
        }
      }
      
      if (provider === 'openrouter') {
        const openRouterConfig = config as any;
        console.log("OpenRouter config received:", JSON.stringify(openRouterConfig));
        
        // Handle both formats (endpoint or apiKey)
        if (openRouterConfig.endpoint && !openRouterConfig.apiKey) {
          console.log("Converting legacy OpenRouter config format");
          openRouterConfig.apiKey = "PLEASE_UPDATE_API_KEY";
        }
        
        if (!openRouterConfig.apiKey || !openRouterConfig.model) {
          return res.status(400).json({ 
            error: "Missing required OpenRouter configuration", 
            details: "API Key and Model are required" 
          });
        }
      }
      
      console.log(`Testing connection for provider: ${provider}`);
      
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
      
      try {
        const isConnected = await tempAiService.testConnection();
        
        if (isConnected) {
          console.log(`Connection test successful for ${provider}`);
          res.json({ success: true, message: 'Connection successful' });
        } else {
          console.log(`Connection test failed for ${provider}`);
          res.status(400).json({ 
            error: 'Connection test failed',
            details: `Could not connect to ${provider}. Please check your configuration.`
          });
        }
      } catch (connectionError: any) {
        console.error(`Connection test error for ${provider}:`, connectionError);
        res.status(400).json({ 
          error: 'Connection test failed',
          details: connectionError.message || String(connectionError)
        });
      }
    } catch (error: any) {
      console.error('Error testing connection:', error);
      res.status(500).json({ 
        error: 'Failed to test connection',
        details: error.message || String(error)
      });
    }
  });

  // Get available Ollama models
  app.get("/api/admin/ollama-models", async (req, res) => {
    try {
      const endpoint = req.query.endpoint as string || DEFAULT_OLLAMA_ENDPOINT;
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

  // Get available OpenRouter models
  app.get("/api/admin/openrouter-models", async (req, res) => {
    try {
      const apiKey = req.query.apiKey as string;
      
      if (!apiKey) {
        return res.status(400).json({ error: 'API key is required' });
      }
      
      // Log API key details for debugging
      console.log(`OpenRouter API key details:`, {
        length: apiKey.length,
        firstChars: apiKey.substring(0, 5),
        lastChars: apiKey.substring(apiKey.length - 5),
        format: apiKey.startsWith('sk-or-') ? 'starts with sk-or-' : 'does not start with sk-or-'
      });
      
      try {
        const models = await aiService.getOpenRouterModels(apiKey);
        
        // Format models for frontend
        const formattedModels = models.map(model => ({
          id: model.id,
          name: model.id,
          context_length: model.context_length,
          pricing: model.pricing
        }));
        
        console.log(`Successfully fetched ${formattedModels.length} OpenRouter models`);
        res.json(formattedModels);
      } catch (modelError: any) {
        console.error('Error fetching OpenRouter models:', modelError);
        res.status(401).json({ 
          error: 'Failed to fetch OpenRouter models. Please check your API key.',
          details: modelError.message || String(modelError)
        });
      }
    } catch (error: any) {
      console.error('Error getting OpenRouter models:', error);
      res.status(500).json({ 
        error: 'Failed to get OpenRouter models',
        details: error.message || String(error)
      });
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

      // Schedule feed sync job
      await schedulerService.triggerFeedSync(feed.id);

      res.json({
        success: true,
        feed,
        message: 'Merchant feed added and initial sync triggered'
      });
    } catch (error) {
      console.error('Error adding merchant feed:', error);
      res.status(500).json({ error: 'Failed to add merchant feed' });
    }
  });

  // Update merchant feed
  app.put("/api/admin/merchant-feeds/:id", async (req, res) => {
    try {
      const feedId = parseInt(req.params.id);
      if (isNaN(feedId)) {
        return res.status(400).json({ error: 'Invalid feed ID' });
      }

      const { name, feedUrl, syncInterval, isActive } = req.body;
      
      // Update feed in storage
      await vectorStorage.updateMerchantFeed(feedId, {
        name,
        feedUrl,
        syncInterval,
        isActive
      });

      // Trigger feed sync job update
      await schedulerService.updateFeedSyncSchedules();

      res.json({
        success: true,
        message: 'Merchant feed updated successfully'
      });
    } catch (error) {
      console.error('Error updating merchant feed:', error);
      res.status(500).json({ error: 'Failed to update merchant feed' });
    }
  });

  // Delete merchant feed
  app.delete("/api/admin/merchant-feeds/:id", async (req, res) => {
    try {
      const feedId = parseInt(req.params.id);
      if (isNaN(feedId)) {
        return res.status(400).json({ error: 'Invalid feed ID' });
      }

      // Delete feed from storage
      await vectorStorage.deleteMerchantFeed(feedId);

      // Update feed sync schedules
      await schedulerService.updateFeedSyncSchedules();

      res.json({
        success: true,
        message: 'Merchant feed deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting merchant feed:', error);
      res.status(500).json({ error: 'Failed to delete merchant feed' });
    }
  });

  // Trigger sync for specific merchant feed
  app.post("/api/admin/merchant-feeds/:id/sync", async (req, res) => {
    try {
      const feedId = parseInt(req.params.id);
      if (isNaN(feedId)) {
        return res.status(400).json({ error: 'Invalid feed ID' });
      }

      const result = await schedulerService.triggerFeedSync(feedId);
      
      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      console.error('Error triggering feed sync:', error);
      res.status(500).json({ error: `Failed to trigger feed sync: ${(error as Error).message}` });
    }
  });

  // Trigger all merchant feed syncs
  app.post("/api/admin/sync-feeds", async (req, res) => {
    try {
      await schedulerService.triggerMerchantFeedSync();
      res.json({ success: true, message: 'Merchant feed sync started' });
    } catch (error) {
      console.error('Error triggering feed sync:', error);
      res.status(500).json({ error: 'Failed to trigger feed sync' });
    }
  });

  // Get scheduler status
  app.get("/api/admin/scheduler-status", async (req, res) => {
    try {
      const status = schedulerService.getJobsStatus();
      res.json(status);
    } catch (error) {
      console.error('Error getting scheduler status:', error);
      res.status(500).json({ error: 'Failed to get scheduler status' });
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