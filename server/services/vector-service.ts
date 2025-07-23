import { ChromaClient, Collection } from 'chromadb';
import { HfInference } from '@huggingface/inference';
import { v4 as uuidv4 } from 'uuid';

export interface VectorDocument {
  id: string;
  content: string;
  metadata?: Record<string, any>;
}

export interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata?: Record<string, any>;
}

export class VectorService {
  private client: ChromaClient;
  private hf?: HfInference;
  private collections: Map<string, Collection> = new Map();
  
  constructor() {
    this.client = new ChromaClient({
      path: 'http://localhost:8000' // Default ChromaDB path
    });
    
    // Initialize Hugging Face for embeddings (fallback)
    if (process.env.HUGGINGFACE_API_TOKEN) {
      this.hf = new HfInference(process.env.HUGGINGFACE_API_TOKEN);
    }
  }

  async initialize() {
    try {
      // Test connection to ChromaDB
      await this.client.heartbeat();
      console.log('✓ ChromaDB connection established');
      
      // Initialize default collections
      await this.getOrCreateCollection('knowledge_base');
      await this.getOrCreateCollection('products');
      await this.getOrCreateCollection('faqs');
      
    } catch (error) {
      console.error('Failed to initialize vector service:', error);
      throw error;
    }
  }

  async getOrCreateCollection(name: string): Promise<Collection> {
    if (this.collections.has(name)) {
      return this.collections.get(name)!;
    }

    try {
      let collection: Collection;
      try {
        collection = await this.client.getCollection({ name });
      } catch {
        collection = await this.client.createCollection({ 
          name,
          metadata: { description: `Collection for ${name}` }
        });
      }
      
      this.collections.set(name, collection);
      return collection;
    } catch (error) {
      console.error(`Failed to get/create collection ${name}:`, error);
      throw error;
    }
  }

  async addDocuments(collectionName: string, documents: VectorDocument[]): Promise<void> {
    try {
      const collection = await this.getOrCreateCollection(collectionName);
      
      const ids = documents.map(doc => doc.id);
      const contents = documents.map(doc => doc.content);
      const metadatas = documents.map(doc => doc.metadata || {});
      
      // Generate embeddings using the default embedding model
      await collection.add({
        ids,
        documents: contents,
        metadatas
      });
      
      console.log(`✓ Added ${documents.length} documents to ${collectionName}`);
    } catch (error) {
      console.error(`Failed to add documents to ${collectionName}:`, error);
      throw error;
    }
  }

  async searchSimilar(
    collectionName: string, 
    query: string, 
    limit: number = 5,
    filter?: Record<string, any>
  ): Promise<SearchResult[]> {
    try {
      const collection = await this.getOrCreateCollection(collectionName);
      
      const results = await collection.query({
        queryTexts: [query],
        nResults: limit,
        where: filter
      });

      if (!results.documents || !results.documents[0]) {
        return [];
      }

      return results.documents[0].map((content, index) => ({
        id: results.ids?.[0]?.[index] || '',
        content: content || '',
        score: results.distances?.[0]?.[index] || 0,
        metadata: results.metadatas?.[0]?.[index] || {}
      }));
    } catch (error) {
      console.error(`Failed to search in ${collectionName}:`, error);
      return [];
    }
  }

  async deleteDocument(collectionName: string, documentId: string): Promise<void> {
    try {
      const collection = await this.getOrCreateCollection(collectionName);
      await collection.delete({ ids: [documentId] });
      console.log(`✓ Deleted document ${documentId} from ${collectionName}`);
    } catch (error) {
      console.error(`Failed to delete document from ${collectionName}:`, error);
      throw error;
    }
  }

  async updateDocument(collectionName: string, document: VectorDocument): Promise<void> {
    try {
      // Delete existing document and add updated one
      await this.deleteDocument(collectionName, document.id);
      await this.addDocuments(collectionName, [document]);
    } catch (error) {
      console.error(`Failed to update document in ${collectionName}:`, error);
      throw error;
    }
  }

  async getCollectionStats(collectionName: string): Promise<{ count: number }> {
    try {
      const collection = await this.getOrCreateCollection(collectionName);
      const count = await collection.count();
      return { count };
    } catch (error) {
      console.error(`Failed to get stats for ${collectionName}:`, error);
      return { count: 0 };
    }
  }

  // Helper method to chunk large text into smaller pieces
  chunkText(text: string, maxChunkSize: number = 1000, overlap: number = 100): string[] {
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

  // Generate unique ID for documents
  generateDocumentId(): string {
    return uuidv4();
  }
}

export const vectorService = new VectorService();