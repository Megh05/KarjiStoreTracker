import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { aiService } from "./services/ai-service";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get the directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to load AI config
function loadAIConfig() {
  try {
    const aiConfigPath = path.join(__dirname, '../data-storage/ai-config.json');
    if (fs.existsSync(aiConfigPath)) {
      console.log(`Loading AI config from: ${aiConfigPath}`);
      const aiConfigData = fs.readFileSync(aiConfigPath, 'utf8');
      console.log(`AI config raw data: ${aiConfigData.substring(0, 100)}...`);
      
      const aiConfig = JSON.parse(aiConfigData);
      
      // Check if the API key is valid (not a placeholder)
      if (aiConfig.provider === 'openrouter' && aiConfig.config && aiConfig.config.apiKey) {
        const apiKey = aiConfig.config.apiKey;
        
        // Check if it's a valid API key (not a placeholder)
        const isPlaceholder = apiKey === 'PLEASE_ADD_YOUR_API_KEY' || 
                             apiKey === 'PLEASE_UPDATE_YOUR_API_KEY' || 
                             apiKey === 'PLEASE_UPDATE_API_KEY';
        
        // If it's a valid API key, log it securely
        if (!isPlaceholder) {
          console.log('Found valid API key:', apiKey.substring(0, 10) + '...');
        }
      }
      
      console.log('AI config parsed:', {
        provider: aiConfig.provider,
        hasConfig: !!aiConfig.config,
        apiKeyExists: aiConfig.config && aiConfig.config.apiKey ? 'yes' : 'no',
        apiKeyFirstChars: aiConfig.config && aiConfig.config.apiKey ? aiConfig.config.apiKey.substring(0, 10) + '...' : 'none',
        model: aiConfig.config ? aiConfig.config.model : 'none'
      });
      
      aiService.setProvider(aiConfig);
      log(`AI service initialized with provider: ${aiConfig.provider}`);
    } else {
      log('AI configuration file not found. AI features will be limited.');
    }
  } catch (error) {
    console.error('Error initializing AI service:', error);
  }
}

// Initialize AI service with configuration from ai-config.json
loadAIConfig();

// DISABLED: Watch for changes to the AI config file
// We've disabled the file watcher to prevent any interference with API key changes
const aiConfigPath = path.join(__dirname, '../data-storage/ai-config.json');
// fs.watchFile(aiConfigPath, (curr, prev) => { ... });

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
