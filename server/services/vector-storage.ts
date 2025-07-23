import { v4 as uuidv4 } from 'uuid';
import { AiConfig, AzureConfig, OllamaConfig, KnowledgeBase, Product, MerchantFeed } from '@shared/schema';

export interface VectorStorageDocument {
  id: string;
  content: string;
  metadata: Record<string, any>;
  type: 'ai_config' | 'knowledge_base' | 'product' | 'merchant_feed' | 'chat_message';
}

// In-memory vector storage fallback when ChromaDB is not available
interface InMemoryDocument {
  id: string;
  content: string;
  metadata: Record<string, any>;
  embedding?: number[]; // Simple text-based similarity for now
}

export class VectorStorage {
  private collections: Map<string, InMemoryDocument[]> = new Map();
  private initialized = false;

  constructor() {
    // Initialize in-memory collections
    this.collections.set('ai_configs', []);
    this.collections.set('knowledge_base', []);
    this.collections.set('products', []);
    this.collections.set('merchant_feeds', []);
    this.collections.set('chat_sessions', []);
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      console.log('✓ Using in-memory vector storage (ChromaDB fallback)');
      this.initialized = true;
      console.log('✓ Vector storage initialized');
    } catch (error) {
      console.error('❌ Failed to initialize vector storage:', error);
      throw error;
    }
  }

  private getCollection(name: string): InMemoryDocument[] {
    if (!this.collections.has(name)) {
      this.collections.set(name, []);
    }
    return this.collections.get(name)!;
  }

  // AI Configuration methods
  async saveAiConfig(config: {
    provider: 'azure' | 'ollama';
    config: AzureConfig | OllamaConfig;
    customInstructions?: string;
  }): Promise<AiConfig> {
    await this.initialize();
    
    const collection = this.getCollection('ai_configs');
    const id = 'current_ai_config';
    
    const aiConfig: AiConfig = {
      id: 1,
      provider: config.provider,
      config: config.config,
      customInstructions: config.customInstructions,
      isActive: true,
      createdOnUtc: new Date(),
      updatedOnUtc: new Date()
    };

    // Remove existing config
    const existingIndex = collection.findIndex(doc => doc.id === id);
    if (existingIndex !== -1) {
      collection.splice(existingIndex, 1);
    }

    // Store new config
    collection.push({
      id,
      content: JSON.stringify(aiConfig),
      metadata: {
        type: 'ai_config',
        provider: config.provider,
        active: true,
        updatedAt: new Date().toISOString()
      }
    });

    return aiConfig;
  }

  async getAiConfig(): Promise<AiConfig | undefined> {
    await this.initialize();
    
    const collection = this.getCollection('ai_configs');
    
    try {
      const doc = collection.find(doc => doc.id === 'current_ai_config');
      if (doc) {
        return JSON.parse(doc.content);
      }
    } catch (error) {
      console.error('Error getting AI config:', error);
    }
    
    return undefined;
  }

  // Knowledge Base methods
  async addKnowledgeBase(knowledge: {
    title: string;
    content: string;
    type: string;
    sourceUrl?: string;
    metadata?: Record<string, any>;
  }): Promise<KnowledgeBase> {
    await this.initialize();
    
    const collection = this.getCollection('knowledge_base');
    const id = uuidv4();
    
    const knowledgeItem: KnowledgeBase = {
      id: Date.now(), // Simple ID for compatibility
      title: knowledge.title,
      content: knowledge.content,
      type: knowledge.type,
      sourceUrl: knowledge.sourceUrl,
      vectorId: id,
      metadata: knowledge.metadata,
      isActive: true,
      createdOnUtc: new Date(),
      updatedOnUtc: new Date()
    };

    // Chunk content for better search
    const chunks = this.chunkText(knowledge.content);

    chunks.forEach((chunk, index) => {
      const chunkId = `${id}_chunk_${index}`;
      collection.push({
        id: chunkId,
        content: chunk,
        metadata: {
          type: 'knowledge_base',
          title: knowledge.title,
          sourceType: knowledge.type,
          sourceUrl: knowledge.sourceUrl,
          chunkIndex: index,
          totalChunks: chunks.length,
          parentId: id,
          isActive: true,
          createdAt: new Date().toISOString(),
          ...knowledge.metadata
        }
      });
    });

    return knowledgeItem;
  }

  async getKnowledgeBase(): Promise<KnowledgeBase[]> {
    await this.initialize();
    
    const collection = this.getCollection('knowledge_base');
    
    try {
      // Group chunks by parentId and reconstruct knowledge items
      const knowledgeMap = new Map<string, any>();
      
      collection.forEach((doc) => {
        if (doc.metadata.type === 'knowledge_base' && doc.metadata.isActive) {
          const parentId = doc.metadata.parentId as string;
          if (!parentId) return;

          if (!knowledgeMap.has(parentId)) {
            knowledgeMap.set(parentId, {
              id: Date.now() + Math.random(),
              title: doc.metadata.title,
              content: '',
              type: doc.metadata.sourceType,
              sourceUrl: doc.metadata.sourceUrl,
              vectorId: parentId,
              metadata: doc.metadata,
              isActive: true,
              createdOnUtc: new Date(doc.metadata.createdAt as string || Date.now()),
              updatedOnUtc: new Date(doc.metadata.createdAt as string || Date.now()),
              chunks: []
            });
          }

          const item = knowledgeMap.get(parentId);
          item.chunks.push({
            index: doc.metadata.chunkIndex,
            content: doc.content
          });
        }
      });

      // Sort chunks and concatenate content
      const knowledgeItems = Array.from(knowledgeMap.values()).map(item => {
        item.chunks.sort((a: any, b: any) => a.index - b.index);
        item.content = item.chunks.map((chunk: any) => chunk.content).join(' ');
        delete item.chunks;
        return item;
      });

      return knowledgeItems;
    } catch (error) {
      console.error('Error getting knowledge base:', error);
      return [];
    }
  }

  async searchKnowledge(query: string, limit: number = 5): Promise<Array<{
    content: string;
    metadata: Record<string, any>;
    score: number;
  }>> {
    await this.initialize();
    
    const collection = this.getCollection('knowledge_base');
    
    try {
      const queryLower = query.toLowerCase();
      const results = collection
        .filter(doc => doc.metadata.type === 'knowledge_base' && doc.metadata.isActive)
        .map(doc => ({
          content: doc.content,
          metadata: doc.metadata,
          score: this.calculateSimilarity(queryLower, doc.content.toLowerCase())
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      return results;
    } catch (error) {
      console.error('Error searching knowledge:', error);
      return [];
    }
  }

  // Product methods
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
    
    const collection = this.getCollection('products');
    const id = uuidv4();
    
    const productItem: Product = {
      id: Date.now(),
      productId: product.productId,
      title: product.title,
      description: product.description || '',
      price: product.price.toString(),
      imageUrl: product.imageUrl,
      productUrl: product.productUrl,
      category: product.category,
      brand: product.brand,
      availability: 'in stock',
      vectorId: id,
      metadata: product.metadata,
      createdOnUtc: new Date(),
      updatedOnUtc: new Date()
    };

    // Create searchable content
    const searchableContent = `${product.title} ${product.description} ${product.category} ${product.brand}`.trim();

    collection.push({
      id,
      content: searchableContent,
      metadata: {
        type: 'product',
        productId: product.productId,
        title: product.title,
        price: product.price,
        imageUrl: product.imageUrl,
        productUrl: product.productUrl,
        category: product.category,
        brand: product.brand,
        createdAt: new Date().toISOString(),
        ...product.metadata
      }
    });

    return productItem;
  }

  async searchProducts(query: string, limit: number = 10): Promise<Array<{
    content: string;
    metadata: Record<string, any>;
    score: number;
  }>> {
    await this.initialize();
    
    const collection = this.getCollection('products');
    
    try {
      const queryLower = query.toLowerCase();
      const results = collection
        .filter(doc => doc.metadata.type === 'product')
        .map(doc => ({
          content: doc.content,
          metadata: doc.metadata,
          score: this.calculateSimilarity(queryLower, doc.content.toLowerCase())
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      return results;
    } catch (error) {
      console.error('Error searching products:', error);
      return [];
    }
  }

  // Merchant Feed methods
  async addMerchantFeed(feed: {
    name: string;
    feedUrl: string;
    syncInterval?: number;
  }): Promise<MerchantFeed> {
    await this.initialize();
    
    const collection = this.getCollection('merchant_feeds');
    const id = uuidv4();
    
    const merchantFeed: MerchantFeed = {
      id: Date.now(),
      name: feed.name,
      feedUrl: feed.feedUrl,
      isActive: true,
      syncInterval: feed.syncInterval || 10800,
      createdOnUtc: new Date()
    };

    collection.push({
      id,
      content: feed.name,
      metadata: {
        type: 'merchant_feed',
        name: feed.name,
        feedUrl: feed.feedUrl,
        isActive: true,
        syncInterval: feed.syncInterval || 10800,
        createdAt: new Date().toISOString()
      }
    });

    return merchantFeed;
  }

  async getMerchantFeeds(): Promise<MerchantFeed[]> {
    await this.initialize();
    
    const collection = this.getCollection('merchant_feeds');
    
    try {
      return collection
        .filter(doc => doc.metadata.type === 'merchant_feed' && doc.metadata.isActive)
        .map((doc, index) => ({
          id: Date.now() + index,
          name: doc.metadata.name as string,
          feedUrl: doc.metadata.feedUrl as string,
          isActive: doc.metadata.isActive as boolean,
          syncInterval: doc.metadata.syncInterval as number,
          lastSyncedAt: doc.metadata.lastSyncedAt ? new Date(doc.metadata.lastSyncedAt as string) : undefined,
          createdOnUtc: new Date(doc.metadata.createdAt as string)
        }));
    } catch (error) {
      console.error('Error getting merchant feeds:', error);
      return [];
    }
  }

  // Chat session methods
  async saveChatMessage(sessionId: string, message: {
    content: string;
    isBot: boolean;
  }) {
    await this.initialize();
    
    const collection = this.getCollection('chat_sessions');
    const id = uuidv4();
    
    collection.push({
      id,
      content: message.content,
      metadata: {
        type: 'chat_message',
        sessionId,
        isBot: message.isBot,
        timestamp: new Date().toISOString()
      }
    });
  }

  async getChatHistory(sessionId: string): Promise<Array<{
    content: string;
    isBot: boolean;
    timestamp: string;
  }>> {
    await this.initialize();
    
    const collection = this.getCollection('chat_sessions');
    
    try {
      const messages = collection
        .filter(doc => doc.metadata.type === 'chat_message' && doc.metadata.sessionId === sessionId)
        .map(doc => ({
          content: doc.content,
          isBot: doc.metadata.isBot as boolean,
          timestamp: doc.metadata.timestamp as string
        }))
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      return messages;
    } catch (error) {
      console.error('Error getting chat history:', error);
      return [];
    }
  }

  // Utility methods
  private chunkText(text: string, maxChunkSize: number = 1000, overlap: number = 100): string[] {
    const chunks: string[] = [];
    let start = 0;
    
    while (start < text.length) {
      const end = Math.min(start + maxChunkSize, text.length);
      const chunk = text.slice(start, end);
      chunks.push(chunk);
      start = end - overlap;
    }
    
    return chunks;
  }

  private calculateSimilarity(query: string, content: string): number {
    // Simple keyword-based similarity scoring
    const queryWords = query.toLowerCase().split(/\s+/);
    const contentWords = content.toLowerCase().split(/\s+/);
    
    let matches = 0;
    for (const word of queryWords) {
      if (contentWords.some(cw => cw.includes(word) || word.includes(cw))) {
        matches++;
      }
    }
    
    return matches / queryWords.length;
  }

  async getStats() {
    await this.initialize();
    
    const stats: Record<string, any> = {};
    
    for (const [name, collection] of this.collections) {
      try {
        stats[name] = { 
          count: collection.length,
          types: collection.reduce((acc, doc) => {
            const type = doc.metadata.type || 'unknown';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        };
      } catch (error) {
        stats[name] = { count: 0, error: (error as Error).message };
      }
    }
    
    return stats;
  }
}

export const vectorStorage = new VectorStorage();