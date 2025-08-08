import { agenticRagService } from './agentic-rag-service';
import { conversationalRagService } from './conversational-rag-service';
import { vectorStorage } from './vector-storage';
import { aiService } from './ai-service';

export interface UnifiedRAGResponse {
  answer: string;
  sources?: Array<{ title: string; url?: string }>;
  confidence: number;
  products?: any[];
  orderData?: any;
  shouldStartProductFlow?: boolean;
  intent?: string;
  conversationContext?: {
    conversationState: string;
    relevantHistory: string[];
    userPreferences: Record<string, any>;
    followUpQuestions: string[];
  };
  searchMetrics?: {
    semanticResults: number;
    keywordResults: number;
    hybridResults: number;
    averageScore: number;
  };
  debug?: {
    reasoning?: string;
    retrievalStrategy?: string;
    contextUsed?: string[];
    confidenceScore?: number;
    productCategory?: string;
    error?: string;
    searchMetrics?: {
      semanticResults: number;
      keywordResults: number;
      hybridResults: number;
      averageScore: number;
    };
    conversationFlow?: string;
    ragType?: 'hybrid' | 'conversational' | 'agentic' | 'combined';
  };
}

export interface RAGStrategy {
  type: 'hybrid' | 'conversational' | 'agentic' | 'combined';
  priority: number;
  conditions: {
    queryLength?: number;
    hasContext?: boolean;
    isFollowUp?: boolean;
    intent?: string[];
    confidence?: number;
  };
}

/**
 * UnifiedRAGOrchestrator - Orchestrates all three RAG types
 * 
 * Key features:
 * 1. Hybrid RAG: Combines semantic + keyword search
 * 2. Conversational RAG: Maintains conversation context
 * 3. Agentic RAG: Uses LLM reasoning for dynamic retrieval
 * 4. Intelligent strategy selection
 * 5. Result combination and ranking
 */
export class UnifiedRAGOrchestrator {
  private strategies: RAGStrategy[] = [
    {
      type: 'conversational',
      priority: 1,
      conditions: {
        hasContext: true,
        isFollowUp: true
      }
    },
    {
      type: 'agentic',
      priority: 2,
      conditions: {
        queryLength: 10,
        confidence: 0.7
      }
    },
    {
      type: 'hybrid',
      priority: 3,
      conditions: {
        intent: ['product_search', 'information_request']
      }
    },
    {
      type: 'combined',
      priority: 4,
      conditions: {}
    }
  ];

  /**
   * Main query method that orchestrates all RAG types
   */
  async query(userQuery: string, sessionId: string): Promise<UnifiedRAGResponse> {
    try {
      console.log(`UnifiedRAG processing query: "${userQuery}" for session: ${sessionId}`);
      
      // Analyze query to determine strategy
      const queryAnalysis = await this.analyzeQuery(userQuery, sessionId);
      
      // Select appropriate RAG strategy
      const selectedStrategy = this.selectStrategy(queryAnalysis);
      
      console.log(`Selected RAG strategy: ${selectedStrategy.type}`);
      
      // Execute selected strategy
      let response: UnifiedRAGResponse;
      
      switch (selectedStrategy.type) {
        case 'conversational':
          response = await this.executeConversationalRAG(userQuery, sessionId);
          break;
        case 'agentic':
          response = await this.executeAgenticRAG(userQuery, sessionId);
          break;
        case 'hybrid':
          response = await this.executeHybridRAG(userQuery, sessionId);
          break;
        case 'combined':
        default:
          response = await this.executeCombinedRAG(userQuery, sessionId);
          break;
      }
      
      // Add strategy information to debug
      response.debug = {
        ...response.debug,
        ragType: selectedStrategy.type
      };
      
      return response;
    } catch (error) {
      console.error('Error in UnifiedRAG:', error);
      return {
        answer: "I'm sorry, I'm having trouble processing your request. Could you please try again?",
        confidence: 0.3,
        debug: {
          error: error instanceof Error ? error.message : 'Unknown error',
          ragType: 'fallback'
        }
      };
    }
  }

  /**
   * Analyze query to determine appropriate strategy
   */
  private async analyzeQuery(
    query: string,
    sessionId: string
  ): Promise<{
    queryLength: number;
    hasContext: boolean;
    isFollowUp: boolean;
    intent: string;
    confidence: number;
    entities: Record<string, any>;
  }> {
    try {
      // Get conversation context
      const conversationContext = conversationalRagService.getConversationContext(sessionId);
      const hasContext = conversationContext && conversationContext.conversationHistory.length > 0;
      
      // Analyze intent using AI
      const systemPrompt = `Analyze this query for a KarjiStore chatbot and return JSON:
{
  "intent": "greeting|product_search|order_tracking|preference_collection|general_inquiry|follow_up",
  "confidence": 0.0-1.0,
  "entities": {
    "products": ["product names"],
    "categories": ["categories"],
    "preferences": {"budget": "low|mid|high", "style": "casual|formal|luxury", "gender": "men|women|unisex"}
  }
}

Query: "${query}"`;

      const response = await aiService.generateResponse([
        { role: 'user', content: systemPrompt }
      ]);

      // Parse JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        return {
          queryLength: query.length,
          hasContext,
          isFollowUp: hasContext && query.length < 20,
          intent: analysis.intent || 'general_inquiry',
          confidence: analysis.confidence || 0.7,
          entities: analysis.entities || {}
        };
      }

      // Fallback analysis
      return {
        queryLength: query.length,
        hasContext,
        isFollowUp: hasContext && query.length < 20,
        intent: this.fallbackIntentAnalysis(query),
        confidence: 0.6,
        entities: {}
      };
    } catch (error) {
      console.error('Error analyzing query:', error);
      return {
        queryLength: query.length,
        hasContext: false,
        isFollowUp: false,
        intent: 'general_inquiry',
        confidence: 0.5,
        entities: {}
      };
    }
  }

  /**
   * Fallback intent analysis
   */
  private fallbackIntentAnalysis(query: string): string {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('hello') || lowerQuery.includes('hi')) return 'greeting';
    if (lowerQuery.includes('order') || lowerQuery.includes('track')) return 'order_tracking';
    if (lowerQuery.includes('perfume') || lowerQuery.includes('watch') || lowerQuery.includes('gift')) return 'product_search';
    if (lowerQuery.includes('prefer') || lowerQuery.includes('like') || lowerQuery.includes('want')) return 'preference_collection';
    
    return 'general_inquiry';
  }

  /**
   * Select appropriate RAG strategy based on query analysis
   */
  private selectStrategy(queryAnalysis: any): RAGStrategy {
    // Sort strategies by priority and check conditions
    const sortedStrategies = [...this.strategies].sort((a, b) => a.priority - b.priority);
    
    for (const strategy of sortedStrategies) {
      if (this.matchesConditions(strategy.conditions, queryAnalysis)) {
        return strategy;
      }
    }
    
    // Default to combined strategy
    return this.strategies.find(s => s.type === 'combined') || this.strategies[0];
  }

  /**
   * Check if query analysis matches strategy conditions
   */
  private matchesConditions(conditions: any, analysis: any): boolean {
    if (conditions.queryLength && analysis.queryLength < conditions.queryLength) {
      return false;
    }
    if (conditions.hasContext !== undefined && analysis.hasContext !== conditions.hasContext) {
      return false;
    }
    if (conditions.isFollowUp !== undefined && analysis.isFollowUp !== conditions.isFollowUp) {
      return false;
    }
    if (conditions.intent && !conditions.intent.includes(analysis.intent)) {
      return false;
    }
    if (conditions.confidence && analysis.confidence < conditions.confidence) {
      return false;
    }
    return true;
  }

  /**
   * Execute Conversational RAG
   */
  private async executeConversationalRAG(
    userQuery: string,
    sessionId: string
  ): Promise<UnifiedRAGResponse> {
    console.log('Executing Conversational RAG...');
    
    const response = await conversationalRagService.processMessage(userQuery, sessionId);
    
    return {
      answer: response.answer,
      confidence: response.confidence,
      conversationContext: response.context,
      debug: {
        reasoning: response.debug?.reasoning,
        conversationFlow: response.debug?.conversationFlow,
        ragType: 'conversational'
      }
    };
  }

  /**
   * Execute Agentic RAG
   */
  private async executeAgenticRAG(
    userQuery: string,
    sessionId: string
  ): Promise<UnifiedRAGResponse> {
    console.log('Executing Agentic RAG...');
    
    const response = await agenticRagService.query(userQuery, sessionId);
    
    return {
      answer: response.answer,
      sources: response.sources,
      confidence: response.confidence || 0.8,
      products: response.products,
      orderData: response.orderData,
      shouldStartProductFlow: response.shouldStartProductFlow,
      intent: response.intent,
      searchMetrics: response.debug?.searchMetrics,
      debug: {
        reasoning: response.debug?.reasoning,
        retrievalStrategy: response.debug?.retrievalStrategy,
        contextUsed: response.debug?.contextUsed,
        confidenceScore: response.debug?.confidenceScore,
        productCategory: response.debug?.productCategory,
        searchMetrics: response.debug?.searchMetrics,
        ragType: 'agentic'
      }
    };
  }

  /**
   * Execute Hybrid RAG
   */
  private async executeHybridRAG(
    userQuery: string,
    sessionId: string
  ): Promise<UnifiedRAGResponse> {
    console.log('Executing Hybrid RAG...');
    
    try {
      // Get conversation context to check if we should show products
      const conversationContext = conversationalRagService.getConversationContext(sessionId);
      const userPreferences = conversationContext?.userPreferences || {};
      
      // Check if we have sufficient preferences to show products
      const hasStylePreference = userPreferences.style;
      const hasBudgetPreference = userPreferences.budget;
      const isGenericQuery = userQuery.toLowerCase().includes('watch') && 
                            !userQuery.toLowerCase().includes('women') && 
                            !userQuery.toLowerCase().includes('men');
      
      // Determine if we should show products based on conversation state
      const shouldShowProducts = hasStylePreference && hasBudgetPreference && !isGenericQuery;
      
      // Perform hybrid search
      const productResults = await vectorStorage.searchProducts(userQuery, 5);
      const knowledgeResults = await vectorStorage.searchKnowledge(userQuery, 3);
      
      // Combine results
      const allResults = [...productResults, ...knowledgeResults];
      
      // Generate response using AI with conversation-aware system prompt
      const context = allResults.map(r => r.content).join('\n\n');
      const systemPrompt = `You are a helpful customer service assistant for KarjiStore. 

CONVERSATION RULES:
- NEVER show products until you have collected sufficient preferences
- For generic queries like "watches", ask about gender first
- For "women watches", ask about style preference
- For "classic", ask about budget
- Only show products after collecting style AND budget preferences

Current user preferences: ${JSON.stringify(userPreferences)}
Should show products: ${shouldShowProducts}

Use this context to answer the user's question:
${context}

Provide a helpful, accurate response based on the context and conversation rules.`;

      const answer = await aiService.generateResponse([
        { role: 'user', content: userQuery }
      ], systemPrompt);
      
      // Process products for display only if appropriate
      const products = shouldShowProducts ? productResults.map(result => ({
        title: result.metadata?.title || 'Unknown Product',
        description: result.content,
        price: result.metadata?.price ? parseFloat(String(result.metadata.price)) : 0,
        imageUrl: result.metadata?.imageUrl || null,
        productUrl: result.metadata?.productUrl || '#'
      })) : undefined;
      
      // Calculate search metrics
      const searchMetrics = {
        semanticResults: allResults.filter(r => r.searchType === 'semantic').length,
        keywordResults: allResults.filter(r => r.searchType === 'keyword').length,
        hybridResults: allResults.filter(r => r.searchType === 'hybrid').length,
        averageScore: allResults.reduce((sum, r) => sum + r.score, 0) / allResults.length
      };
      
      return {
        answer,
        confidence: 0.8,
        products,
        searchMetrics,
        debug: {
          contextUsed: allResults.map(r => r.metadata?.title || 'Unknown'),
          searchMetrics,
          ragType: 'hybrid',
          conversationFlow: `Preferences: ${JSON.stringify(userPreferences)}, ShouldShowProducts: ${shouldShowProducts}`
        }
      };
    } catch (error) {
      console.error('Error in Hybrid RAG:', error);
      return {
        answer: "I'm sorry, I couldn't find relevant information for your query.",
        confidence: 0.4,
        debug: {
          error: error instanceof Error ? error.message : 'Unknown error',
          ragType: 'hybrid'
        }
      };
    }
  }

  /**
   * Execute Combined RAG (all three types)
   */
  private async executeCombinedRAG(
    userQuery: string,
    sessionId: string
  ): Promise<UnifiedRAGResponse> {
    console.log('Executing Combined RAG...');
    
    try {
      // Execute all three RAG types in parallel
      const [conversationalResponse, agenticResponse, hybridResponse] = await Promise.allSettled([
        this.executeConversationalRAG(userQuery, sessionId),
        this.executeAgenticRAG(userQuery, sessionId),
        this.executeHybridRAG(userQuery, sessionId)
      ]);
      
      // Combine results intelligently
      const responses = [];
      if (conversationalResponse.status === 'fulfilled') responses.push(conversationalResponse.value);
      if (agenticResponse.status === 'fulfilled') responses.push(agenticResponse.value);
      if (hybridResponse.status === 'fulfilled') responses.push(hybridResponse.value);
      
      if (responses.length === 0) {
        throw new Error('All RAG strategies failed');
      }
      
      // Select best response based on confidence and content
      const bestResponse = this.selectBestResponse(responses);
      
      // Combine debug information
      const combinedDebug = {
        reasoning: `Combined ${responses.length} RAG strategies`,
        ragType: 'combined',
        strategies: responses.map(r => r.debug?.ragType).filter(Boolean)
      };
      
      return {
        ...bestResponse,
        debug: {
          ...bestResponse.debug,
          ...combinedDebug
        }
      };
    } catch (error) {
      console.error('Error in Combined RAG:', error);
      return {
        answer: "I'm sorry, I'm having trouble processing your request. Could you please try again?",
        confidence: 0.3,
        debug: {
          error: error instanceof Error ? error.message : 'Unknown error',
          ragType: 'combined'
        }
      };
    }
  }

  /**
   * Select the best response from multiple RAG strategies
   */
  private selectBestResponse(responses: UnifiedRAGResponse[]): UnifiedRAGResponse {
    // Sort by confidence and content quality
    return responses.sort((a, b) => {
      // Prefer responses with higher confidence
      if (Math.abs(a.confidence - b.confidence) > 0.1) {
        return b.confidence - a.confidence;
      }
      
      // Prefer responses with products if query seems product-related
      const hasProductsA = a.products && a.products.length > 0;
      const hasProductsB = b.products && b.products.length > 0;
      if (hasProductsA !== hasProductsB) {
        return hasProductsA ? 1 : -1;
      }
      
      // Prefer longer, more detailed responses
      return b.answer.length - a.answer.length;
    })[0];
  }

  /**
   * Get conversation context
   */
  getConversationContext(sessionId: string) {
    return conversationalRagService.getConversationContext(sessionId);
  }

  /**
   * Clear conversation context
   */
  clearConversationContext(sessionId: string) {
    conversationalRagService.clearConversationContext(sessionId);
  }
}

export const unifiedRagOrchestrator = new UnifiedRAGOrchestrator(); 