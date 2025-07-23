import { vectorStorage } from './vector-storage';
import { aiService } from './ai-service';
import { storage } from '../storage';

export interface RAGResponse {
  answer: string;
  sources: SearchResult[];
  confidence: number;
}

export class RAGService {
  async query(userQuery: string, sessionId: string): Promise<RAGResponse> {
    try {
      // 1. Determine query intent and type
      const queryIntent = await this.analyzeQueryIntent(userQuery);
      
      // 2. Search relevant information from multiple sources
      const searchResults = await this.searchRelevantContent(userQuery, queryIntent);
      
      // 3. Generate contextual response
      const response = await this.generateContextualResponse(
        userQuery, 
        searchResults, 
        sessionId,
        queryIntent
      );
      
      return {
        answer: response,
        sources: searchResults,
        confidence: this.calculateConfidence(searchResults)
      };
    } catch (error) {
      console.error('RAG Service Error:', error);
      return {
        answer: 'I apologize, but I encountered an issue processing your request. Please try again or contact support if the problem persists.',
        sources: [],
        confidence: 0
      };
    }
  }

  private async analyzeQueryIntent(query: string): Promise<string> {
    const lowerQuery = query.toLowerCase();
    
    // Order tracking keywords
    if (lowerQuery.includes('order') && (lowerQuery.includes('track') || lowerQuery.includes('status'))) {
      return 'order_tracking';
    }
    
    // Product recommendation keywords
    if (lowerQuery.includes('recommend') || lowerQuery.includes('suggest') || 
        lowerQuery.includes('looking for') || lowerQuery.includes('need')) {
      return 'product_recommendation';
    }
    
    // FAQ/Support keywords
    if (lowerQuery.includes('how') || lowerQuery.includes('what') || 
        lowerQuery.includes('help') || lowerQuery.includes('support')) {
      return 'support';
    }
    
    return 'general';
  }

  private async searchRelevantContent(query: string, intent: string): Promise<SearchResult[]> {
    const allResults: SearchResult[] = [];
    
    try {
      // Search knowledge base
      const knowledgeResults = await vectorStorage.searchKnowledge(query, 3);
      allResults.push(...knowledgeResults.map(r => ({
        id: r.metadata.parentId || 'unknown',
        content: r.content,
        score: r.score,
        metadata: r.metadata
      })));
      
      // Search products if it's a product-related query
      if (intent === 'product_recommendation' || intent === 'general') {
        const productResults = await vectorStorage.searchProducts(query, 5);
        allResults.push(...productResults.map(r => ({
          id: r.metadata.productId || 'unknown',
          content: r.content,
          score: r.score,
          metadata: r.metadata
        })));
      }
      
      // Sort by relevance score and return top results
      return allResults
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);
        
    } catch (error) {
      console.error('Error searching relevant content:', error);
      return [];
    }
  }

  private async generateContextualResponse(
    query: string, 
    searchResults: SearchResult[], 
    sessionId: string,
    intent: string
  ): Promise<string> {
    try {
      // Get conversation history for context
      const conversationHistory = await this.getConversationHistory(sessionId);
      
      // Build context from search results
      const context = this.buildContextFromResults(searchResults, intent);
      
      // Prepare messages for AI
      const messages = [
        ...conversationHistory.slice(-6), // Last 6 messages for context
        {
          role: 'user',
          content: query
        }
      ];
      
      // Generate response using AI service
      const response = await aiService.generateResponse(messages, context);
      
      return response;
    } catch (error) {
      console.error('Error generating contextual response:', error);
      throw error;
    }
  }

  private buildContextFromResults(results: SearchResult[], intent: string): string {
    if (results.length === 0) {
      return 'No specific information found. Provide general assistance based on your knowledge.';
    }
    
    let context = `Based on the following information, provide a helpful response:\n\n`;
    
    results.forEach((result, index) => {
      context += `${index + 1}. ${result.content}\n`;
      if (result.metadata?.source) {
        context += `   Source: ${result.metadata.source}\n`;
      }
      context += '\n';
    });
    
    // Add intent-specific instructions
    switch (intent) {
      case 'product_recommendation':
        context += `\nFocus on recommending relevant products from the search results. Include prices, features, and links when available.`;
        break;
      case 'support':
        context += `\nProvide step-by-step guidance based on the FAQ and support information found.`;
        break;
      case 'order_tracking':
        context += `\nIf order tracking information is not found in the context, ask for the customer's email and order ID to look up their specific order.`;
        break;
    }
    
    return context;
  }

  private async getConversationHistory(sessionId: string): Promise<{ role: string; content: string }[]> {
    try {
      const messages = await vectorStorage.getChatHistory(sessionId);
      return messages.map(msg => ({
        role: msg.isBot ? 'assistant' : 'user',
        content: msg.content
      }));
    } catch (error) {
      console.error('Error getting conversation history:', error);
      return [];
    }
  }

  private calculateConfidence(results: SearchResult[]): number {
    if (results.length === 0) return 0;
    
    // Calculate confidence based on relevance scores
    const avgScore = results.reduce((sum, result) => sum + result.score, 0) / results.length;
    const maxScore = Math.max(...results.map(r => r.score));
    
    // Normalize to 0-1 range
    const confidence = Math.min(1, (avgScore + maxScore) / 2);
    return Math.round(confidence * 100) / 100;
  }

  // Add document to knowledge base
  async addKnowledgeDocument(
    title: string, 
    content: string, 
    type: string,
    sourceUrl?: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    try {
      // Add to vector storage only
      const knowledgeItem = await vectorStorage.addKnowledgeBase({
        title,
        content,
        type,
        sourceUrl,
        metadata
      });
      
      return knowledgeItem.vectorId || knowledgeItem.id.toString();
    } catch (error) {
      console.error('Error adding knowledge document:', error);
      throw error;
    }
  }

  // Add product to vector database
  async addProduct(productData: {
    productId: string;
    title: string;
    description: string;
    price: number;
    imageUrl?: string;
    productUrl?: string;
    category?: string;
    brand?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      // Add to vector storage only
      await vectorStorage.addProduct(productData);
    } catch (error) {
      console.error('Error adding product:', error);
      throw error;
    }
  }
}

export const ragService = new RAGService();