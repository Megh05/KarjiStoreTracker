import { v4 as uuidv4 } from 'uuid';
import { AiConfig, AzureConfig, OllamaConfig, OpenRouterConfig, KnowledgeBase, Product, MerchantFeed } from '@shared/schema';
import fs from 'fs';
import path from 'path';

// File-based vector storage that persists data to disk
export class VectorStorage {
  private storagePath: string;
  private aiConfig: any = null;
  private knowledgeItems: any[] = [];
  private productItems: any[] = [];
  private merchantFeeds: any[] = [];
  private chatMessages: Map<string, any[]> = new Map();
  private initialized = false;

  constructor() {
    // Create storage directory in the project root
    this.storagePath = path.join(process.cwd(), 'data-storage');
    
    // Ensure directory exists
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      console.log('Initializing file-based vector storage...');
      
      // Load data from files
      await this.loadAiConfig();
      await this.loadKnowledgeBase();
      await this.loadProducts();
      await this.loadMerchantFeeds();
      
      this.initialized = true;
      console.log('✓ Vector storage initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize vector storage:', error);
      throw error;
    }
  }

  // File operations
  private async loadFromFile<T>(filename: string, defaultValue: T): Promise<T> {
    const filePath = path.join(this.storagePath, filename);
    
    try {
      if (fs.existsSync(filePath)) {
        const data = await fs.promises.readFile(filePath, 'utf8');
        return JSON.parse(data) as T;
      }
    } catch (error) {
      console.error(`Error loading ${filename}:`, error);
    }
    
    return defaultValue;
  }

  private async saveToFile(filename: string, data: any): Promise<void> {
    const filePath = path.join(this.storagePath, filename);
    
    try {
      await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
      console.error(`Error saving ${filename}:`, error);
      throw error;
    }
  }

  // AI Configuration methods
  private async loadAiConfig() {
    this.aiConfig = await this.loadFromFile<AiConfig | null>('ai-config.json', null);
  }

  async saveAiConfig(config: {
    provider: 'azure' | 'ollama' | 'openrouter';
    config: AzureConfig | OllamaConfig | OpenRouterConfig;
    customInstructions?: string;
  }) {
    await this.initialize();
    
    console.log(`Starting saveAiConfig for provider: ${config.provider}`);
    
    // Special handling for OpenRouter - NO VALIDATION, NO PROCESSING
    if (config.provider === 'openrouter') {
      const openRouterConfig = config.config as any;
      
      // Log the raw config without any processing
      console.log("Raw OpenRouter config to save:", {
        apiKeyExists: openRouterConfig?.apiKey !== undefined,
        apiKeyValue: openRouterConfig?.apiKey,
        apiKeyType: typeof openRouterConfig?.apiKey,
        model: openRouterConfig?.model
      });
      
      // Do not modify the config object at all - pass it through as-is
    }
    
    // Create the config object
    const aiConfig = {
      id: 1,
      provider: config.provider,
      config: config.config,
      customInstructions: config.customInstructions || null,
      isActive: true,
      createdOnUtc: this.aiConfig?.createdOnUtc || new Date(),
      updatedOnUtc: new Date()
    };
    
    // Log before saving
    if (config.provider === 'openrouter') {
      const finalConfig = aiConfig.config as any;
      console.log("Final OpenRouter config to be saved:", {
        apiKeyExists: finalConfig?.apiKey !== undefined,
        apiKeyValue: finalConfig?.apiKey,
        apiKeyType: typeof finalConfig?.apiKey,
        model: finalConfig?.model
      });
    }
    
    this.aiConfig = aiConfig;
    await this.saveToFile('ai-config.json', aiConfig);
    return aiConfig;
  }

  async getAiConfig(): Promise<AiConfig | undefined> {
    await this.initialize();
    return this.aiConfig;
  }

  // Knowledge Base methods
  private async loadKnowledgeBase() {
    this.knowledgeItems = await this.loadFromFile<any[]>('knowledge-base.json', []);
  }

  async addKnowledgeBase(knowledge: {
    title: string;
    content: string;
    type: string;
    sourceUrl?: string;
    metadata?: Record<string, any>;
  }): Promise<KnowledgeBase> {
    await this.initialize();
    
    const id = this.knowledgeItems.length + 1;
    const vectorId = uuidv4();
    
    // Create embeddings for vector search (simplified)
    const embeddings = this.createSimpleEmbeddings(knowledge.title + ' ' + knowledge.content);
    
    const knowledgeItem: KnowledgeBase & { embeddings?: number[] } = {
      id,
      title: knowledge.title,
      content: knowledge.content,
      type: knowledge.type,
      sourceUrl: knowledge.sourceUrl || null,
      vectorId,
      metadata: knowledge.metadata || {},
      isActive: true,
      createdOnUtc: new Date(),
      updatedOnUtc: new Date(),
      embeddings
    };

    this.knowledgeItems.push(knowledgeItem);
    
    // Save to file (without embeddings to save space)
    const itemToSave = { ...knowledgeItem };
    delete itemToSave.embeddings;
    await this.saveToFile('knowledge-base.json', this.knowledgeItems.map(item => {
      const copy = { ...item };
      delete copy.embeddings;
      return copy;
    }));
    
    console.log(`Added knowledge item: ${knowledge.title} (ID: ${id})`);
    return knowledgeItem;
  }

  async getKnowledgeBase(): Promise<KnowledgeBase[]> {
    await this.initialize();
    return this.knowledgeItems.map(item => {
      const copy = { ...item };
      delete copy.embeddings;
      return copy;
    });
  }

  async searchKnowledge(query: string, limit: number = 5): Promise<Array<{
    content: string;
    metadata: Record<string, any>;
    score: number;
  }>> {
    await this.initialize();
    
    try {
      console.log(`Searching knowledge base for: "${query}"`);
      
      // Create query embeddings
      const queryEmbeddings = this.createSimpleEmbeddings(query);
      
      // Calculate cosine similarity with all knowledge items
      const results = this.knowledgeItems
        .filter(item => item.isActive)
        .map(item => {
          let score = 0;
          
          // If we have embeddings, use them for similarity
          if (item.embeddings && queryEmbeddings) {
            score = this.calculateCosineSimilarity(queryEmbeddings, item.embeddings);
          } else {
            // Fallback to simple keyword matching
            score = this.calculateSimpleScore(
              query.toLowerCase(), 
              (item.title + ' ' + item.content).toLowerCase()
            );
          }
          
          return {
            content: item.content,
            metadata: {
              title: item.title,
              type: item.type,
              sourceUrl: item.sourceUrl,
              ...item.metadata
            },
            score
          };
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      console.log(`Found ${results.length} knowledge results for query: "${query}"`);
      return results;
    } catch (error) {
      console.error('Error searching knowledge:', error);
      return [];
    }
  }

  // Product methods
  private async loadProducts() {
    this.productItems = await this.loadFromFile<any[]>('products.json', []);
  }

  async truncateAllProducts(): Promise<void> {
    await this.initialize();
    
    console.log('Truncating all products - deleting products.json file');
    
    // Get current count of products
    const productsCount = this.productItems.length;
    
    // Clear all products in memory
    this.productItems = [];
    
    // Delete the file and create a new empty one
    const filePath = path.join(this.storagePath, 'products.json');
    
    try {
      // Delete the file if it exists
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('Deleted existing products.json file');
      }
      
      // Create a new empty file
      fs.writeFileSync(filePath, JSON.stringify([]));
      console.log('Created new empty products.json file');
    } catch (error) {
      console.error('Error deleting/creating products.json file:', error);
    }
    
    console.log(`Removed all ${productsCount} products`);
  }

  async addProduct(product: {
    productId: string;
    title: string;
    description: string;
    price: number;
    imageUrl?: string;
    productUrl?: string;
    category?: string;
    brand?: string;
    metadata?: Record<string, any>;
  }): Promise<Product> {
    await this.initialize();
    
    const id = this.productItems.length + 1;
    const vectorId = uuidv4();
    
    // Create content for vector search
    const content = `${product.title}. ${product.description} ${product.brand || ''} ${product.category || ''}`;
    
    // Create embeddings
    const embeddings = this.createSimpleEmbeddings(content);
    
    // Create a product item that matches the Product type
    const productItem = {
      id,
      productId: product.productId,
      title: product.title,
      description: product.description || null,
      price: product.price.toString(), // Convert number to string for storage
      imageUrl: product.imageUrl || null,
      productUrl: product.productUrl || null,
      category: product.category || null,
      brand: product.brand || null,
      vectorId,
      metadata: product.metadata || {},
      createdOnUtc: new Date(),
      updatedOnUtc: new Date(),
      // Add any other fields required by the Product type
    };

    // Add embeddings and feedId separately as they're not part of the Product type
    const productItemWithEmbeddings = {
      ...productItem,
      embeddings,
      feedId: product.metadata?.feedId
    };

    this.productItems.push(productItemWithEmbeddings);
    
    // Save to file (without embeddings)
    await this.saveToFile('products.json', this.productItems.map(item => {
      const copy = { ...item };
      delete copy.embeddings;
      return copy;
    }));
    
    console.log(`Added product: ${product.title} (ID: ${id})`);
    return productItem as Product;
  }

  async clearProductsByFeedId(feedId: number): Promise<void> {
    await this.initialize();
    
    console.log(`Clearing products for feed ID: ${feedId}`);
    
    // Get count of products to be removed
    const productsToRemoveCount = this.productItems.filter(product => product.feedId === feedId).length;
    
    // Remove products completely instead of marking them inactive
    this.productItems = this.productItems.filter(product => product.feedId !== feedId);
    
    // Save to file
    await this.saveToFile('products.json', this.productItems.map(item => {
      const copy = { ...item };
      delete copy.embeddings;
      return copy;
    }));
    
    console.log(`Removed ${productsToRemoveCount} products for feed ID: ${feedId}`);
  }

  async searchProducts(query: string, limit: number = 10): Promise<Array<{
    content: string;
    metadata: Record<string, any>;
    score: number;
  }>> {
    await this.initialize();
    
    try {
      // Create query embeddings
      const queryEmbeddings = this.createSimpleEmbeddings(query);
      
      const results = this.productItems
        .map(item => {
          const content = `${item.title}. ${item.description}`;
          let score = 0;
          
          // If we have embeddings, use them for similarity
          if (item.embeddings && queryEmbeddings) {
            score = this.calculateCosineSimilarity(queryEmbeddings, item.embeddings);
          } else {
            // Fallback to simple keyword matching
            score = this.calculateSimpleScore(query.toLowerCase(), content.toLowerCase());
          }
          
          return {
            content,
            metadata: {
              productId: item.productId,
              title: item.title,
              price: item.price,
              imageUrl: item.imageUrl,
              productUrl: item.productUrl,
              category: item.category,
              brand: item.brand,
              ...item.metadata
            },
            score
          };
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      return results;
    } catch (error) {
      console.error('Error searching products:', error);
      return [];
    }
  }

  // Merchant Feed methods
  private async loadMerchantFeeds() {
    this.merchantFeeds = await this.loadFromFile<any[]>('merchant-feeds.json', []);
  }

  async addMerchantFeed(feed: {
    name: string;
    feedUrl: string;
    syncInterval?: number;
  }): Promise<MerchantFeed> {
    await this.initialize();
    
    const id = this.merchantFeeds.length + 1;
    
    const merchantFeed: MerchantFeed = {
      id,
      name: feed.name,
      feedUrl: feed.feedUrl,
      syncInterval: feed.syncInterval || 10800, // Default to 3 hours
      isActive: true,
      createdOnUtc: new Date(),
      lastSyncedAt: null
    };

    this.merchantFeeds.push(merchantFeed);
    
    // Save to file
    await this.saveToFile('merchant-feeds.json', this.merchantFeeds);
    
    console.log(`Added merchant feed: ${feed.name} (ID: ${id})`);
    return merchantFeed;
  }

  async updateMerchantFeed(id: number, updates: Partial<{
    name: string;
    feedUrl: string;
    syncInterval: number;
    isActive: boolean;
    lastSyncedAt: Date;
  }>): Promise<void> {
    await this.initialize();
    
    const feedIndex = this.merchantFeeds.findIndex(feed => feed.id === id);
    if (feedIndex === -1) {
      throw new Error(`Merchant feed with ID ${id} not found`);
    }
    
    // Update feed properties
    const feed = this.merchantFeeds[feedIndex];
    Object.assign(feed, {
      ...updates,
      updatedOnUtc: new Date()
    });
    
    // Save to file
    await this.saveToFile('merchant-feeds.json', this.merchantFeeds);
    
    console.log(`Updated merchant feed: ${feed.name} (ID: ${id})`);
  }

  async deleteMerchantFeed(id: number): Promise<void> {
    await this.initialize();
    
    const feedIndex = this.merchantFeeds.findIndex(feed => feed.id === id);
    if (feedIndex === -1) {
      throw new Error(`Merchant feed with ID ${id} not found`);
    }
    
    // Remove the feed completely instead of marking as inactive
    this.merchantFeeds.splice(feedIndex, 1);
    
    // Save to file
    await this.saveToFile('merchant-feeds.json', this.merchantFeeds);
    
    // Also remove associated products
    await this.clearProductsByFeedId(id);
    
    console.log(`Deleted merchant feed with ID: ${id}`);
  }

  async getMerchantFeeds(): Promise<MerchantFeed[]> {
    await this.initialize();
    return this.merchantFeeds.filter(feed => feed.isActive);
  }

  // Chat methods
  async saveChatMessage(sessionId: string, message: {
    content: string;
    isBot: boolean;
  }) {
    await this.initialize();
    
    if (!this.chatMessages.has(sessionId)) {
      this.chatMessages.set(sessionId, []);
    }
    
    const sessionMessages = this.chatMessages.get(sessionId)!;
    sessionMessages.push({
      content: message.content,
        isBot: message.isBot,
        timestamp: new Date().toISOString()
    });
    
    // Keep only last 20 messages per session to save memory
    if (sessionMessages.length > 20) {
      this.chatMessages.set(sessionId, sessionMessages.slice(-20));
    }
    
    // Save to file
    const sessionFile = `chat-session-${sessionId}.json`;
    await this.saveToFile(sessionFile, sessionMessages);
  }

  async getChatHistory(sessionId: string): Promise<Array<{
    content: string;
    isBot: boolean;
    timestamp: string;
  }>> {
    await this.initialize();
    
    // If not in memory, try to load from file
    if (!this.chatMessages.has(sessionId)) {
      const sessionFile = `chat-session-${sessionId}.json`;
      const messages = await this.loadFromFile<any[]>(sessionFile, []);
      this.chatMessages.set(sessionId, messages);
    }
    
    return this.chatMessages.get(sessionId) || [];
  }

  // Vector operations
  private createSimpleEmbeddings(text: string): number[] {
    // This is a very simplified embedding function
    // In a real implementation, you would use a proper embedding model
    
    try {
      // Convert text to lowercase and remove special characters
      const cleanText = text.toLowerCase().replace(/[^\w\s]/g, '');
      
      // Get unique words
      const uniqueWords = new Set(cleanText.split(/\s+/).filter(w => w.length > 2));
      const words = Array.from(uniqueWords);
      
      // Create a simple frequency-based embedding (very basic)
      // For demonstration purposes only - not a real embedding
      const embedding: number[] = [];
      for (let i = 0; i < Math.min(words.length, 100); i++) {
        // Generate a pseudo-random value based on the word
        const word = words[i];
        let value = 0;
        for (let j = 0; j < word.length; j++) {
          value += word.charCodeAt(j) / 255;
        }
        embedding.push(value / word.length);
      }
      
      // Pad to 100 dimensions
      while (embedding.length < 100) {
        embedding.push(0);
      }
      
      // Normalize
      const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      if (magnitude > 0) {
        for (let i = 0; i < embedding.length; i++) {
          embedding[i] /= magnitude;
        }
      }
      
      return embedding;
    } catch (error) {
      console.error('Error creating embeddings:', error);
      return Array(100).fill(0); // Return zero vector on error
    }
  }

  private calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
    try {
      if (!vec1 || !vec2 || vec1.length !== vec2.length) {
        return 0;
      }
      
      let dotProduct = 0;
      for (let i = 0; i < vec1.length; i++) {
        dotProduct += vec1[i] * vec2[i];
      }
      
      return Math.max(0, Math.min(1, dotProduct));
    } catch (error) {
      console.error('Error calculating cosine similarity:', error);
      return 0;
    }
  }

  private calculateSimpleScore(query: string, content: string): number {
    try {
      // Simple keyword matching
      const queryWords = query.split(/\s+/).filter(w => w.length > 2);
      if (queryWords.length === 0) return 0;
    
    let matches = 0;
    for (const word of queryWords) {
        if (content.includes(word)) {
        matches++;
      }
    }
    
    return matches / queryWords.length;
    } catch (error) {
      console.error('Error calculating simple score:', error);
      return 0;
    }
  }

  async getStats() {
    await this.initialize();
    
    const stats: Record<string, any> = {
      ai_configs: {
        count: this.aiConfig ? 1 : 0,
        types: this.aiConfig ? { ai_config: 1 } : {}
      },
      knowledge_base: {
        count: this.knowledgeItems.length,
        types: { knowledge_base: this.knowledgeItems.length }
      },
      products: {
        count: this.productItems.filter(p => p.isActive).length,
        types: { product: this.productItems.filter(p => p.isActive).length }
      },
      merchant_feeds: {
        count: this.merchantFeeds.filter(f => f.isActive).length,
        types: { merchant_feed: this.merchantFeeds.filter(f => f.isActive).length }
      },
      chat_sessions: {
        count: this.chatMessages.size,
        types: { 
          chat_message: Array.from(this.chatMessages.values())
            .reduce((total, messages) => total + messages.length, 0) 
        }
      }
    };
    
    return stats;
  }
}

export const vectorStorage = new VectorStorage();