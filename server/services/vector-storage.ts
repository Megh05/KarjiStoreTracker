import { v4 as uuidv4 } from 'uuid';
import { AiConfig, AzureConfig, OllamaConfig, OpenRouterConfig, KnowledgeBase, Product, MerchantFeed } from '@shared/schema';
import fs from 'fs';
import path from 'path';

// Enhanced file-based vector storage with hybrid search capabilities
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
      console.log('Initializing enhanced file-based vector storage with hybrid search...');
      
      // Load data from files
      await this.loadAiConfig();
      await this.loadKnowledgeBase();
      await this.loadProducts();
      await this.loadMerchantFeeds();
      
      this.initialized = true;
      console.log('✓ Enhanced vector storage initialized successfully');
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

  // Enhanced Knowledge Base methods with hybrid search
  private async loadKnowledgeBase() {
    const items = await this.loadFromFile<any[]>('knowledge-base.json', []);
    // Regenerate embeddings/keywords in memory for loaded items
    this.knowledgeItems = items.map((item: any) => {
      const title = (item.title || '').toString();
      const content = (item.content || '').toString();
      const text = `${title} ${content}`;
      return {
        ...item,
        embeddings: this.createEnhancedEmbeddings(text),
        keywords: item.keywords && Array.isArray(item.keywords) && item.keywords.length > 0
          ? item.keywords
          : this.extractKeywords(text)
      };
    });
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
    
    // Create enhanced embeddings for vector search
    const embeddings = this.createEnhancedEmbeddings(knowledge.title + ' ' + knowledge.content);
    
    // Extract keywords for hybrid search
    const keywords = this.extractKeywords(knowledge.title + ' ' + knowledge.content);
    
    const knowledgeItem: KnowledgeBase & { embeddings?: number[]; keywords?: string[] } = {
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
      embeddings,
      keywords
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

  // Enhanced hybrid search for knowledge base
  async searchKnowledge(query: string, limit: number = 5): Promise<Array<{
    content: string;
    metadata: Record<string, any>;
    score: number;
    searchType: 'semantic' | 'keyword' | 'hybrid';
  }>> {
    await this.initialize();
    
    try {
      console.log(`Performing enhanced hybrid search for knowledge: "${query}"`);

      const lowerQuery = query.toLowerCase();

      // Detect knowledge topics from query
      const topics = this.detectKnowledgeTopicsFromQuery(lowerQuery);

      // Create embeddings and expanded keywords
      const queryEmbeddings = this.createEnhancedEmbeddings(lowerQuery);
      const queryKeywordsBase = this.extractKeywords(lowerQuery);
      const queryKeywords = this.expandWithSynonyms(queryKeywordsBase);

      // Score each knowledge item
      const scored = this.knowledgeItems
        .filter(item => item.isActive)
        .map(item => {
          const title = (item.title || '').toString();
          const type = (item.type || '').toString();
          const content = `${title}. ${(item.content || '').toString()}`;
          const lowerContent = content.toLowerCase();

          // Embedding similarity
          let semantic = 0;
          if (item.embeddings && queryEmbeddings) {
            semantic = this.calculateCosineSimilarity(queryEmbeddings, item.embeddings);
          }

          // Keyword similarity with synonym expansion
          const itemKeywordsBase = item.keywords || this.extractKeywords(lowerContent);
          const itemKeywords = this.expandWithSynonyms(itemKeywordsBase);
          const keyword = this.calculateKeywordSimilarity(queryKeywords, itemKeywords);

          // Heuristic boosts
          let boost = 0;
          let penalty = 0;

          // Title/topic boosts
          const lt = title.toLowerCase();
          if (topics.isShipping && /(shipping|delivery|international|track|courier|express)/.test(lowerContent)) boost += 0.35;
          if (topics.isReturns && /(return|refund|exchange|policy|warranty)/.test(lowerContent)) boost += 0.35;
          if (topics.isOrder && /(order|tracking|status|where is|shipped|delivered)/.test(lowerContent)) boost += 0.35;
          if (topics.isPayment && /(payment|credit|card|paypal|bank|installment)/.test(lowerContent)) boost += 0.3;
          if (topics.isStore && /(store|location|branch|dubai|abu dhabi|uae)/.test(lowerContent)) boost += 0.3;
          if (topics.isCustomerService && /(customer service|support|contact|help)/.test(lowerContent)) boost += 0.25;
          if (topics.isAuthenticity && /(authentic|genuine|warranty|guarantee)/.test(lowerContent)) boost += 0.35;
          if (topics.isGift && /(gift|gift set|present|packaging)/.test(lowerContent)) boost += 0.25;
          if (topics.isPerfumeGuide && /(perfume|fragrance|scent|edp|edt)/.test(lowerContent)) boost += 0.25;
          if (topics.isWatchGuide && /(watch|timepiece|chronograph)/.test(lowerContent)) boost += 0.25;

          // Type alignment boosts
          if (topics.isShipping && type.includes('shipping')) boost += 0.25;
          if (topics.isReturns && type.includes('return')) boost += 0.25;
          if (topics.isOrder && type.includes('order')) boost += 0.2;
          if (topics.isPayment && type.includes('payment')) boost += 0.2;
          if (topics.isPerfumeGuide && type.includes('perfume')) boost += 0.2;
          if (topics.isWatchGuide && type.includes('watch')) boost += 0.2;
          if (topics.isGift && type.includes('gift')) boost += 0.2;
          if (topics.isAuthenticity && type.includes('authentic')) boost += 0.2;

          // Strong title matches
          if (topics.isShipping && /(shipping|delivery)/.test(lt)) boost += 0.25;
          if (topics.isReturns && /(return|refund|policy)/.test(lt)) boost += 0.25;
          if (topics.isOrder && /(order|tracking|status)/.test(lt)) boost += 0.25;

          // Mismatch penalties when query is clearly about a specific policy area
          const isPolicySpecific = topics.isShipping || topics.isReturns || topics.isOrder || topics.isPayment || topics.isAuthenticity;
          if (isPolicySpecific) {
            const matchesAny = boost > 0 || keyword > 0.05 || semantic > 0.05;
            // Penalize product-category heavy content for policy queries
            if (/(perfume|watch|jewel)/.test(lowerContent) && !/(policy|return|shipping|order|payment|authentic)/.test(lowerContent)) {
              penalty += 0.2;
            }
            if (!matchesAny) penalty += 0.1;
          }

          const combined = 0.65 * semantic + 0.35 * keyword + boost - penalty;

          return {
            content: item.content,
            metadata: {
              title: item.title,
              type: item.type,
              sourceUrl: item.sourceUrl,
              ...item.metadata
            },
            score: combined,
            searchType: 'hybrid' as const
          };
        })
        .filter(item => item.score > 0.05)
        .sort((a, b) => b.score - a.score);

      const finalResults = scored.slice(0, limit);
      console.log(`Found ${finalResults.length} knowledge results using enhanced hybrid search`);
      return finalResults;
    } catch (error) {
      console.error('Error searching knowledge:', error);
      return [];
    }
  }

  // Enhanced Product methods with hybrid search
  private async loadProducts() {
    const items = await this.loadFromFile<any[]>('products.json', []);
    // Regenerate embeddings/keywords in memory for loaded products
    this.productItems = items.map((item: any) => {
      const content = `${item.title || ''}. ${item.description || ''}`;
      return {
        ...item,
        embeddings: this.createEnhancedEmbeddings(content.toString()),
        keywords: item.keywords && Array.isArray(item.keywords) && item.keywords.length > 0
          ? item.keywords
          : this.extractKeywords(content.toString())
      };
    });
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
    
    // Create enhanced embeddings
    const embeddings = this.createEnhancedEmbeddings(content);
    const keywords = this.extractKeywords(content);
    
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
      keywords,
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

  // Enhanced hybrid search for products
  async searchProducts(query: string, limit: number = 10): Promise<Array<{
    content: string;
    metadata: Record<string, any>;
    score: number;
    searchType: 'semantic' | 'keyword' | 'hybrid';
  }>> {
    await this.initialize();
    
    try {
      console.log(`Performing enhanced hybrid search for products: "${query}"`);

      const lowerQuery = query.toLowerCase();

      // Detect category and gender with synonym support
      const { isWatchQuery, isPerfumeQuery, isJewelryQuery } = this.detectCategoryFromQuery(lowerQuery);
      const { isWomenQuery, isMenQuery } = this.detectGenderFromQuery(lowerQuery);

      // Parse budget constraints if present
      const budget = this.parseBudgetFromQuery(lowerQuery);
      if (budget.min > 0 || budget.max < Infinity) {
        console.log(`Detected budget constraints in query: min=${budget.min}, max=${budget.max}`);
      }

      // Create embeddings and expanded keyword sets
      const queryEmbeddings = this.createEnhancedEmbeddings(lowerQuery);
      const queryKeywordsBase = this.extractKeywords(lowerQuery);
      const queryKeywords = this.expandWithSynonyms(queryKeywordsBase);

      // Score each product
      const scored = this.productItems.map(item => {
        const title = (item.title || '').toString();
        const description = (item.description || '').toString();
        const brand = (item.brand || '').toString();
        const content = `${title}. ${description}`;
        const lowerContent = content.toLowerCase();

        // Embedding similarity
        let semantic = 0;
        if (item.embeddings && queryEmbeddings) {
          semantic = this.calculateCosineSimilarity(queryEmbeddings, item.embeddings);
        }

        // Keyword similarity with synonym expansion
        const itemKeywordsBase = item.keywords || this.extractKeywords(lowerContent);
        const itemKeywords = this.expandWithSynonyms(itemKeywordsBase);
        const keyword = this.calculateKeywordSimilarity(queryKeywords, itemKeywords);

        // Heuristic boosts and penalties
        let boost = 0;
        let penalty = 0;

        // Category boosts
        const hasWatch = /(watch|watches|timepiece|chronograph)/.test(lowerContent);
        const hasPerfume = /(perfume|fragrance|cologne|edp|edt|eau de parfum|eau de toilette)/.test(lowerContent);
        const hasJewelry = /(jewel|jewelry|jewellery|necklace|bracelet|ring|earring)/.test(lowerContent);

        if (isWatchQuery && hasWatch) {
          boost += 0.4;
        }
        if (isPerfumeQuery && hasPerfume) {
          boost += 0.4;
        }
        if (isJewelryQuery && hasJewelry) {
          boost += 0.4;
        }

        // Gender boosts
        if (isWomenQuery && (lowerContent.includes('women') || lowerContent.includes('ladies') || lowerContent.includes('female') || lowerContent.includes('feminine'))) {
          boost += 0.25;
        }
        if (isMenQuery && ((lowerContent.includes('men') && !lowerContent.includes('women')) || lowerContent.includes('male') || lowerContent.includes('masculine') || lowerContent.includes('gentlemen'))) {
          boost += 0.25;
        }

        // Title weight: matches in title are stronger
        const lt = title.toLowerCase();
        if (isWatchQuery && /(watch|watches)/.test(lt)) boost += 0.2;
        if (isPerfumeQuery && (lt.includes('perfume') || lt.includes('edp') || lt.includes('edt'))) boost += 0.2;
        if (isJewelryQuery && (lt.includes('jewelry') || lt.includes('jewellery') || lt.includes('necklace') || lt.includes('ring') || lt.includes('bracelet') || lt.includes('earring'))) boost += 0.2;

        // Mismatch penalties for category-specific queries
        if (isWatchQuery) {
          if (!hasWatch) penalty += 0.15; // deprioritize non-watch items
          if (hasPerfume) penalty += 0.35; // strong penalty if clearly perfume
        }
        if (isPerfumeQuery) {
          if (!hasPerfume) penalty += 0.15;
          if (hasWatch) penalty += 0.30;
        }
        if (isJewelryQuery) {
          if (!hasJewelry) penalty += 0.15;
        }

        // Brand boost if brand mentioned in query
        if (brand && brand.length > 0 && lowerQuery.includes(brand.toLowerCase())) {
          boost += 0.15;
        }

        // Budget filter and proximity boost
        let priceNum = 0;
        if (typeof item.price === 'string') priceNum = parseFloat(item.price);
        else if (typeof item.price === 'number') priceNum = item.price;

        let budgetPenalty = 0;
        if (budget.min > 0 || budget.max < Infinity) {
          if (isFinite(priceNum)) {
            const within = priceNum >= budget.min && priceNum <= budget.max;
            if (!within) {
              budgetPenalty = 0.5; // penalize out-of-range
            } else {
              // Proximity boost: closer to middle of range gets small bonus
              const mid = (budget.min + budget.max) / 2;
              const range = Math.max(1, budget.max - budget.min);
              const proximity = 1 - Math.min(1, Math.abs(priceNum - mid) / range);
              boost += 0.1 * proximity;
            }
          }
        }

        // Combine scores
        // Weight semantic higher than keyword, then add heuristic boosts and subtract penalties
        const combined = 0.6 * semantic + 0.4 * keyword + boost - budgetPenalty - penalty;

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
          score: combined,
          searchType: 'hybrid' as const,
          _raw: { semantic, keyword, boost, budgetPenalty }
        };
      });

      // Filter low-score results and sort
      let results = scored.filter(r => r.score > 0.05)
        .sort((a, b) => b.score - a.score);

      // Deduplicate by productId/title
      const seen = new Set<string>();
      results = results.filter(r => {
        const key = (r.metadata.productId || '') + '|' + (r.metadata.title || '');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Strict budget filter if present: prefer in-range items when available
      if (budget.min > 0 || budget.max < Infinity) {
        const inRange = results.filter(r => {
          const p = typeof r.metadata.price === 'string' ? parseFloat(r.metadata.price) : (r.metadata.price || 0);
          return isFinite(p) && p >= budget.min && p <= budget.max;
        });
        // Use in-range if we have enough to display
        if (inRange.length >= Math.min(limit, 3)) {
          results = inRange;
        }
      }

      // Final category-focused narrowing if query is clearly category-specific
      if (isWatchQuery) {
        const cat = results.filter(r => {
          const title = (r.metadata.title || '').toLowerCase();
          const content = (r.content || '').toLowerCase();
          const hasWatch = /\bwatch(?:es)?\b|timepiece|chronograph/.test(title) || /\bwatch(?:es)?\b|timepiece|chronograph/.test(content);
          const titleJewelry = /jewel|jewelry|jewellery|necklace|bracelet|ring|earring/.test(title);
          if (hasWatch) return true;
          // If it's clearly jewelry by title and not a watch, exclude
          if (titleJewelry) return false;
          return false;
        });
        if (cat.length > 0) results = cat;
      }
      if (isPerfumeQuery) {
        const cat = results.filter(r => (r.metadata.title || '').toLowerCase().match(/perfume|edp|edt|cologne/) || (r.content || '').toLowerCase().match(/perfume|fragrance|cologne/));
        if (cat.length > 0) results = cat;
      }
      if (isJewelryQuery) {
        const cat = results.filter(r => (r.metadata.title || '').toLowerCase().match(/jewel|necklace|bracelet|ring|earring/) || (r.content || '').toLowerCase().match(/jewel|necklace|bracelet|ring|earring/));
        if (cat.length > 0) results = cat;
      }

      const finalResults = results.slice(0, limit).map(({ _raw, ...rest }) => rest);
      console.log(`Found ${finalResults.length} product results using enhanced hybrid search`);
      return finalResults;
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
      // Check if sessionId already includes a prefix
      const sessionFile = sessionId.startsWith('test_session_') || sessionId.startsWith('session_')
        ? `chat-session-${sessionId}.json`
        : `chat-session-${sessionId}.json`;
      
      console.log(`Looking for chat history in file: ${sessionFile}`);
      const messages = await this.loadFromFile<any[]>(sessionFile, []);
      
      if (messages.length > 0) {
        console.log(`Found ${messages.length} messages in chat history file`);
      } else {
        console.log(`No messages found in chat history file`);
      }
      
      this.chatMessages.set(sessionId, messages);
    }
    
    return this.chatMessages.get(sessionId) || [];
  }

  // Enhanced Vector operations
  private createEnhancedEmbeddings(text: string): number[] {
    // Enhanced embedding function with better semantic understanding
    try {
      // Convert text to lowercase and remove special characters
      const cleanText = text.toLowerCase().replace(/[^\w\s]/g, '');
      
      // Get unique words with better filtering
      const words = cleanText.split(/\s+/)
        .filter(w => w.length > 2)
        .filter(w => !this.isStopWord(w));
      
      // Create a more sophisticated embedding
      const embedding: number[] = [];
      
      // Word frequency analysis
      const wordFreq: Record<string, number> = {};
      words.forEach(word => {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      });
      
      // Create embedding based on word frequency and position
      const uniqueWords = Object.keys(wordFreq);
      for (let i = 0; i < Math.min(uniqueWords.length, 100); i++) {
        const word = uniqueWords[i];
        const freq = wordFreq[word];
        
        // Calculate value based on frequency and word characteristics
        let value = 0;
        for (let j = 0; j < word.length; j++) {
          value += word.charCodeAt(j) / 255;
        }
        value = (value / word.length) * Math.log(freq + 1);
        
        embedding.push(value);
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
      console.error('Error creating enhanced embeddings:', error);
      return Array(100).fill(0);
    }
  }

  private extractKeywords(text: string): string[] {
    // Extract meaningful keywords from text
    const cleanText = text.toLowerCase().replace(/[^\w\s]/g, '');
    const words = cleanText.split(/\s+/)
      .filter(w => w.length > 2)
      .filter(w => !this.isStopWord(w));
    
    // Remove duplicates and return
    return Array.from(new Set(words));
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those'
    ]);
    return stopWords.has(word);
  }

  // --- Enhanced hybrid search helpers ---
  private detectCategoryFromQuery(lowerQuery: string): { isWatchQuery: boolean; isPerfumeQuery: boolean; isJewelryQuery: boolean } {
    const isWatchQuery = /\b(watch|watches|timepiece|chronograph)\b/.test(lowerQuery);
    const isPerfumeQuery = /\b(perfume|fragrance|cologne|edp|edt|eau de parfum|eau de toilette)\b/.test(lowerQuery);
    const isJewelryQuery = /\b(jewel|jewelry|jewellery|necklace|bracelet|ring|earring)\b/.test(lowerQuery);
    return { isWatchQuery, isPerfumeQuery, isJewelryQuery };
  }

  private detectGenderFromQuery(lowerQuery: string): { isWomenQuery: boolean; isMenQuery: boolean } {
    const isWomenQuery = /\b(women|ladies|female|woman|feminine|her)\b/.test(lowerQuery);
    const isMenQuery = /\b(men|male|gentlemen|masculine|his)\b/.test(lowerQuery);
    return { isWomenQuery, isMenQuery };
  }

  private parseBudgetFromQuery(lowerQuery: string): { min: number; max: number } {
    let min = 0;
    let max = Infinity;

    const underMatch = lowerQuery.match(/under\s+(\d+)/i) || lowerQuery.match(/less\s+than\s+(\d+)/i);
    const betweenMatch = lowerQuery.match(/between\s+(\d+)\s+and\s+(\d+)/i) || lowerQuery.match(/(\d+)\s*(?:-|to)\s*(\d+)/i);
    const overMatch = lowerQuery.match(/over\s+(\d+)/i) || lowerQuery.match(/more\s+than\s+(\d+)/i);
    const currencyMatch = lowerQuery.match(/(\d+)\s*(aed|dollars?|dirhams?)/i);

    if (underMatch) {
      max = parseInt(underMatch[1], 10);
    } else if (betweenMatch) {
      min = parseInt(betweenMatch[1], 10);
      max = parseInt(betweenMatch[2], 10);
    } else if (overMatch) {
      min = parseInt(overMatch[1], 10);
    } else if (currencyMatch) {
      max = parseInt(currencyMatch[1], 10);
    }

    return { min, max };
  }

  private expandWithSynonyms(keywords: string[]): string[] {
    const out = new Set<string>();
    const add = (w: string) => { if (w) out.add(w); };
    const lower = keywords.map(w => w.toLowerCase());
    for (const w of lower) {
      add(w);
      // Category synonyms
      if (w === 'watch' || w === 'watches' || w === 'timepiece' || w === 'chronograph') {
        ['watch','watches','timepiece','chronograph'].forEach(add);
      }
      if (w === 'perfume' || w === 'fragrance' || w === 'scent' || w === 'cologne' || w === 'edp' || w === 'edt') {
        ['perfume','fragrance','scent','cologne','edp','edt','parfum','toilette'].forEach(add);
      }
      if (w === 'jewelry' || w === 'jewellery' || w === 'necklace' || w === 'bracelet' || w === 'ring' || w === 'earring') {
        ['jewelry','jewellery','necklace','bracelet','ring','earring'].forEach(add);
      }
      // Gender synonyms
      if (w === 'women' || w === 'ladies' || w === 'female' || w === 'woman' || w === 'feminine') {
        ['women','ladies','female','woman','feminine','her'].forEach(add);
      }
      if (w === 'men' || w === 'male' || w === 'gentlemen' || w === 'masculine') {
        ['men','male','gentlemen','masculine','his'].forEach(add);
      }
    }
    return Array.from(out);
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

  private calculateKeywordSimilarity(queryKeywords: string[], itemKeywords: string[]): number {
    try {
      if (queryKeywords.length === 0 || itemKeywords.length === 0) {
        return 0;
      }
      
      const querySet = new Set(queryKeywords);
      const itemSet = new Set(itemKeywords);
      
      // Calculate Jaccard similarity
      const intersection = new Set(Array.from(querySet).filter(x => itemSet.has(x)));
      const union = new Set([...Array.from(querySet), ...Array.from(itemSet)]);
      
      return intersection.size / union.size;
    } catch (error) {
      console.error('Error calculating keyword similarity:', error);
      return 0;
    }
  }

  private combineSearchResults(
    semanticResults: Array<{ content: string; metadata: any; score: number; searchType: 'semantic' }>,
    keywordResults: Array<{ content: string; metadata: any; score: number; searchType: 'keyword' }>,
    limit: number
  ): Array<{ content: string; metadata: any; score: number; searchType: 'semantic' | 'keyword' | 'hybrid' }> {
    // Create a map to track unique results by content
    const resultMap = new Map<string, { content: string; metadata: any; score: number; searchType: 'semantic' | 'keyword' | 'hybrid' }>();
    
    // Add semantic results
    semanticResults.forEach(result => {
      const key = result.content.substring(0, 100); // Use first 100 chars as key
      if (!resultMap.has(key) || resultMap.get(key)!.score < result.score) {
        resultMap.set(key, { ...result, searchType: 'semantic' });
      }
    });
    
    // Add keyword results, combining scores if content already exists
    keywordResults.forEach(result => {
      const key = result.content.substring(0, 100);
      if (resultMap.has(key)) {
        // Combine scores for hybrid approach
        const existing = resultMap.get(key)!;
        const combinedScore = (existing.score + result.score) / 2;
        resultMap.set(key, { ...result, score: combinedScore, searchType: 'hybrid' });
      } else {
        resultMap.set(key, { ...result, searchType: 'keyword' });
      }
    });
    
    // Convert to array and sort by score
    return Array.from(resultMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private detectKnowledgeTopicsFromQuery(lowerQuery: string): {
    isShipping: boolean;
    isReturns: boolean;
    isOrder: boolean;
    isPayment: boolean;
    isStore: boolean;
    isCustomerService: boolean;
    isPerfumeGuide: boolean;
    isWatchGuide: boolean;
    isGift: boolean;
    isAuthenticity: boolean;
  } {
    const isShipping = /(shipping|delivery|ship|international|courier|express)/.test(lowerQuery);
    const isReturns = /(return|refund|exchange|policy)/.test(lowerQuery);
    const isOrder = /(order|track|tracking|status|where is my)/.test(lowerQuery);
    const isPayment = /(payment|credit|card|paypal|bank|installment)/.test(lowerQuery);
    const isStore = /(store|location|branch|dubai|abu dhabi|uae)/.test(lowerQuery);
    const isCustomerService = /(customer service|support|contact|help)/.test(lowerQuery);
    const isPerfumeGuide = /(perfume|fragrance|scent)/.test(lowerQuery);
    const isWatchGuide = /(watch|timepiece|chronograph)/.test(lowerQuery);
    const isGift = /(gift|gift set|present)/.test(lowerQuery);
    const isAuthenticity = /(authentic|genuine|warranty|guarantee)/.test(lowerQuery);

    return { isShipping, isReturns, isOrder, isPayment, isStore, isCustomerService, isPerfumeGuide, isWatchGuide, isGift, isAuthenticity };
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