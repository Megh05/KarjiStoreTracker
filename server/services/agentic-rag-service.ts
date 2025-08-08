import { aiService } from './ai-service';
import { vectorStorage } from './vector-storage';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Define the SearchResult interface
export interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata?: {
    source?: string;
    title?: string;
    productId?: string;
    parentId?: string;
    [key: string]: any;
  };
}

export interface AgenticRAGResponse {
  answer: string;
  sources?: Array<{ title: string; url?: string }>;
  confidence?: number;
  products?: any[];
  orderData?: any;
  shouldStartProductFlow?: boolean;
  intent?: string;
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
  };
}

/**
 * AgenticRAGService - An advanced RAG implementation that uses LLM-based reasoning
 * for dynamic context retrieval, self-reflection, and adaptive memory management.
 * 
 * Key features:
 * 1. Dynamic context retrieval based on query understanding
 * 2. Self-reflective reasoning for better response generation
 * 3. Adaptive memory mechanism for conversation context
 * 4. Intelligent routing without static intents
 * 5. Multi-stage reasoning pipeline
 */
export class AgenticRAGService {
  // Memory cache for session-specific information
  private sessionMemory: Map<string, {
    preferences?: Record<string, any>;
    recentQueries?: string[];
    contextHistory?: string[];
    productInteractions?: any[];
    lastQueryTimestamp?: Date;
    conversationFlow?: {
      currentState: string;
      collectedInfo: Record<string, any>;
      pendingQuestions: string[];
    };
    userProfile?: {
      name?: string;
      email?: string;
      preferences: {
        budget?: string;
        style?: string;
        occasion?: string;
        category?: string;
        gender?: string;
        brand?: string[];
      };
      interactionHistory: Array<{
        timestamp: Date;
        query: string;
        response: string;
        productsViewed: string[];
        intent: string;
      }>;
    };
  }> = new Map();

  /**
   * Main query method that orchestrates the agentic RAG pipeline
   */
  async query(userQuery: string, sessionId: string): Promise<AgenticRAGResponse> {
    try {
      console.log(`AgenticRAGService processing query: "${userQuery}"`);
      
      // Initialize or retrieve session memory
      this.initializeSessionMemory(sessionId);
      
      // Get conversation history
      const conversationHistory = await this.getConversationHistory(sessionId);
      
      // Check if this is a follow-up question
      const isFollowUp = this.isFollowUpQuestion(userQuery, conversationHistory);
      
      // Extract preferences from query
      const extractedPreferences = await this.extractPreferencesFromQuery(userQuery);
      if (Object.keys(extractedPreferences).length > 0) {
        this.updateUserPreferences(sessionId, extractedPreferences);
        console.log('Extracted preferences:', extractedPreferences);
      }
      
      // Step 1: Query understanding - analyze what the user is asking for
      const queryAnalysis = await this.analyzeQuery(userQuery, conversationHistory, sessionId, isFollowUp);
      console.log(`Query analysis:`, queryAnalysis);
      
      // Step 2: Dynamic context retrieval based on the query understanding
      const retrievedContext = await this.retrieveRelevantContext(
        userQuery, 
        queryAnalysis, 
        sessionId
      );
      console.log(`Retrieved ${retrievedContext.results.length} context items`);
      
      // Step 3: Generate a response using multi-stage reasoning
      const response = await this.generateResponse(
        userQuery,
        retrievedContext,
        conversationHistory,
        queryAnalysis
      );
      
      // Step 4: Update session memory with new information
      this.updateSessionMemory(sessionId, userQuery, queryAnalysis, response);
      
      // Step 5: Save conversation messages
      await this.saveConversationMessages(userQuery, response.answer, sessionId);
      
      // Add intent and shouldStartProductFlow to the response
      response.intent = queryAnalysis.intent;
      response.shouldStartProductFlow = queryAnalysis.shouldStartProductFlow;
      
      return response;
    } catch (error) {
      console.error('Error in AgenticRAGService query:', error);
      
      // Save the error conversation
      try {
        const errorMessage = "I'm sorry, I encountered an error while processing your request. Please try again later.";
        await this.saveConversationMessages(userQuery, errorMessage, sessionId);
        
        return {
          answer: errorMessage,
          confidence: 0
        };
      } catch (saveError) {
        console.error('Error saving error conversation:', saveError);
        return {
          answer: "I'm sorry, I encountered an error while processing your request. Please try again later.",
          confidence: 0
        };
      }
    }
  }

  /**
   * Analyze the query to understand user intent, information needs, and context requirements
   * This uses the LLM to perform a deep analysis rather than relying on static patterns
   */
  private async analyzeQuery(query: string, conversationHistory: any[], sessionId?: string, isFollowUp?: boolean): Promise<{
    informationNeeds: string[];
    contextTypes: string[];
    complexity: number;
    isProductRelated: boolean;
    isOrderRelated: boolean;
    requiresPersonalization: boolean;
    explicitPreferences: Record<string, any>;
    reasoning: string;
    shouldStartProductFlow?: boolean;
    intent?: string;
    productCategory?: string;
  }> {
    // Use the passed isFollowUp parameter or determine if it's a follow-up query
    const isFollowUpQuery = isFollowUp !== undefined ? isFollowUp : (conversationHistory.length > 0 && query.trim().split(/\s+/).length <= 3);
    
    // Get user preferences if sessionId is provided
    const userPreferences = sessionId ? this.getUserPreferences(sessionId) : {};
    
    // Construct a prompt for the LLM to analyze the query
    const analysisPrompt = `
You are an AI assistant for KarjiStore, a luxury retail store specializing in perfumes, watches, and jewelry.
Analyze this query semantically in the context of the conversation history to understand:

1. What specific information is the user looking for? Analyze the underlying need, not just the explicit request.
2. What types of context would be most helpful (product info, knowledge base, conversation history)?
3. How complex is the query (scale 1-5, where 5 is most complex)?
4. Is the query product-related? Consider the semantic meaning, not just keywords.
5. Is the query order-related? Consider the user's intent to track or inquire about orders.
6. Does the query require personalization based on user preferences?
7. What explicit or implicit preferences did the user mention (budget, style, features, etc.)?
8. What is the intent of the query? Choose one: greeting, product_search, product_recommendation, order_tracking, support, other
9. What specific product category is the user interested in? (e.g., "watch", "perfume", "jewelry", "gift")
10. Should we start a product preference collection flow? (true/false)
   - Set to true if the query is about products but lacks specific preferences needed for good recommendations
   - Set to true for general product inquiries where collecting preferences would improve the response quality
   - Set to false if the query contains enough specific details to provide relevant products immediately
   - Set to false if this is a follow-up query to a previous product conversation

User Query: "${query}"

${userPreferences && Object.keys(userPreferences).length > 0 ? `\nUser preferences from previous interactions: ${JSON.stringify(userPreferences)}` : ''}

Conversation History:
${conversationHistory.slice(-5).map(msg => `${msg.role}: ${msg.content}`).join('\n')}

${isFollowUpQuery ? 'NOTE: This appears to be a follow-up query. Consider the conversation context when analyzing.' : ''}

Provide your analysis in JSON format with these exact field names:
{
  "informationNeeds": ["array of specific information needs"],
  "contextTypes": ["array of context types needed"],
  "complexity": number,
  "isProductRelated": boolean,
  "isOrderRelated": boolean,
  "requiresPersonalization": boolean,
  "explicitPreferences": {"object with user preferences"},
  "productCategory": "string (e.g., watch, perfume, jewelry, gift)",
  "reasoning": "string explaining your analysis",
  "intent": "string (greeting|product_search|product_recommendation|order_tracking|support|other)",
  "shouldStartProductFlow": boolean
}
`;

    // Create a system message with the analysis instructions
    const systemMessage = { role: 'system', content: analysisPrompt };
    
    // Include conversation history as separate message objects for proper context
    const messages = [
      systemMessage,
      ...conversationHistory.slice(-5), // Last 5 messages of conversation history
      { role: 'user', content: query }  // Current query
    ];
    
    // Log the actual messages being sent
    console.log(`Sending ${messages.length} messages to LLM for analysis:`, {
      systemMessage: messages.filter(m => m.role === 'system').length > 0,
      userMessages: messages.filter(m => m.role === 'user').length,
      assistantMessages: messages.filter(m => m.role === 'assistant').length,
      conversationHistoryLength: conversationHistory.length,
      isFollowUpQuery
    });
    
    const analysisResponse = await aiService.generateResponse(messages);
    
    // Parse the JSON response with better error handling
    try {
      // Extract JSON from the response (in case the LLM added any extra text)
      const jsonMatch = analysisResponse.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : analysisResponse;
      
      console.log('Raw analysis response:', analysisResponse);
      console.log('Extracted JSON string:', jsonStr);
      
      const analysis = JSON.parse(jsonStr);
      
      // Validate required fields
      const requiredFields = [
        'informationNeeds', 'contextTypes', 'complexity', 'isProductRelated', 
        'isOrderRelated', 'requiresPersonalization', 'explicitPreferences', 
        'reasoning', 'intent', 'shouldStartProductFlow'
      ];
      
      const missingFields = requiredFields.filter(field => !(field in analysis));
      if (missingFields.length > 0) {
        console.warn(`Missing fields in analysis: ${missingFields.join(', ')}`);
      }
      
      // For follow-up queries, don't start product flow if we already have context
      if (isFollowUp && conversationHistory.length > 0) {
        analysis.shouldStartProductFlow = false;
        console.log('Follow-up query detected, setting shouldStartProductFlow to false');
      }
      
      // Ensure all required fields are present with defaults
      return {
        informationNeeds: analysis.informationNeeds || [],
        contextTypes: analysis.contextTypes || ['product', 'knowledge', 'conversation'],
        complexity: analysis.complexity || 3,
        isProductRelated: analysis.isProductRelated || false,
        isOrderRelated: analysis.isOrderRelated || false,
        requiresPersonalization: analysis.requiresPersonalization || false,
        explicitPreferences: analysis.explicitPreferences || {},
        productCategory: analysis.productCategory || '',
        reasoning: analysis.reasoning || '',
        intent: analysis.intent || 'other',
        // If intent is product_recommendation or product_search, we should start the product flow by default
        // But only if this is not a follow-up question to an existing product conversation
        shouldStartProductFlow: (analysis.intent === 'product_recommendation' || analysis.intent === 'product_search') && !isFollowUp
          ? true 
          : (analysis.shouldStartProductFlow || false)
      };
    } catch (error) {
      console.error('Error parsing query analysis:', error);
      console.error('Raw response that failed to parse:', analysisResponse);
      
      // Return default analysis if parsing fails
      // Use a more semantic approach for fallback analysis
      const lowerQuery = query.toLowerCase();
      
      // Use conversation context to better understand the query
      const hasRecentProductContext = conversationHistory
        .slice(-3)
        .some(msg => msg.content.toLowerCase().includes('product') || 
                     msg.content.toLowerCase().includes('recommend') ||
                     msg.content.toLowerCase().includes('suggest'));
      
      // Determine if this is a product query based on semantic understanding
      // rather than hardcoded keywords
      const isProductRelated = this.semanticallyClassifyQuery(lowerQuery, 'product') || hasRecentProductContext;
      
      // Determine if we should start product flow based on query complexity and specificity
      // Only start product flow for initial product queries, not follow-ups
      const shouldStartProductFlow = isProductRelated && 
                                    !this.containsSpecificProductIdentifier(lowerQuery) &&
                                    !isFollowUp; // Don't start flow for follow-ups
      
      // Try to determine product category from query
      let productCategory = '';
      if (lowerQuery.includes('watch')) productCategory = 'watch';
      else if (lowerQuery.includes('perfume') || lowerQuery.includes('fragrance') || lowerQuery.includes('cologne')) productCategory = 'perfume';
      else if (lowerQuery.includes('jewelry')) productCategory = 'jewelry';
      else if (lowerQuery.includes('gift')) productCategory = 'gift';
      
      return {
        informationNeeds: ['general information'],
        contextTypes: ['knowledge', 'conversation'],
        complexity: 3,
        isProductRelated,
        isOrderRelated: this.semanticallyClassifyQuery(lowerQuery, 'order'),
        requiresPersonalization: false,
        explicitPreferences: {},
        productCategory,
        reasoning: 'Failed to parse LLM analysis, using fallback analysis',
        intent: isProductRelated ? (shouldStartProductFlow ? 'product_recommendation' : 'product_search') : 'other',
        shouldStartProductFlow
      };
    }
  }
  
  /**
   * Semantically classify a query without relying on hardcoded keywords
   * This is a more flexible approach than simple keyword matching
   */
  private semanticallyClassifyQuery(query: string, category: 'product' | 'order'): boolean {
    // For product queries, look for patterns that indicate product interest
    if (category === 'product') {
      // Check for question patterns about items, recommendations, or shopping
      return /what (kind|type|sort) of|can you (recommend|suggest)|suggest|recommend|looking for|interested in|show me|find me|perfume|watch|jewelry|fragrance|product|gift set|gift|sets/.test(query);
    }
    
    // For order queries, look for patterns related to tracking or order status
    if (category === 'order') {
      // Check for patterns related to order status or tracking
      return /where is|status|when will|receive|arrive|shipped|delivery|track/.test(query);
    }
    
    return false;
  }
  
  /**
   * Check if a query contains specific product identifiers that indicate
   * the user knows exactly what they want (vs. needing recommendations)
   */
  private containsSpecificProductIdentifier(query: string): boolean {
    // Check for specific product identifiers like model numbers, exact names
    const hasProductCode = /[A-Z0-9]{5,}|[A-Z][A-Z0-9]+-[A-Z0-9]+/.test(query);
    
    // Check if query is a very specific product name (not just "suggest me perfume")
    const words = query.split(' ');
    const isSpecificQuery = words.length > 6 && 
                           !query.toLowerCase().includes('suggest') && 
                           !query.toLowerCase().includes('recommend') &&
                           !query.toLowerCase().includes('show me');
    
    return hasProductCode || isSpecificQuery;
  }

  /**
   * Enhanced retrieveRelevantContext with hybrid search capabilities
   */
  private async retrieveRelevantContext(
    query: string,
    queryAnalysis: any,
    sessionId: string
  ): Promise<{
    results: SearchResult[];
    strategy: string;
    products?: any[];
    searchMetrics?: {
      semanticResults: number;
      keywordResults: number;
      hybridResults: number;
      averageScore: number;
    };
  }> {
    const retrievalStrategies = [];
    const allResults: SearchResult[] = [];
    let products: any[] = [];
    const searchMetrics = {
      semanticResults: 0,
      keywordResults: 0,
      hybridResults: 0,
      averageScore: 0
    };
    
    // Get session memory
    const memory = this.sessionMemory.get(sessionId) || {};
    
    console.log(`Enhanced context retrieval for query: "${query}"`);
    console.log(`Query analysis:`, queryAnalysis);
    
    // Determine which retrieval strategies to use based on query analysis
    if (queryAnalysis.isProductRelated) {
      retrievalStrategies.push('hybrid_product');
      
      console.log('Performing hybrid product search...');
      
      // Use productCategory if available to enhance the search
      if (queryAnalysis.productCategory) {
        console.log(`Using product category: ${queryAnalysis.productCategory}`);
        
        // Create a more specific search query that includes the category
        const enhancedQuery = `${query} ${queryAnalysis.productCategory}`;
        const productResults = await vectorStorage.searchProducts(enhancedQuery, 8);
        
        console.log(`Found ${productResults.length} product results for category: ${queryAnalysis.productCategory}`);
        
        // Track search metrics
        productResults.forEach(result => {
          if (result.searchType === 'semantic') searchMetrics.semanticResults++;
          else if (result.searchType === 'keyword') searchMetrics.keywordResults++;
          else if (result.searchType === 'hybrid') searchMetrics.hybridResults++;
        });
        
        // Convert to SearchResult format
        const formattedResults = productResults.map(r => ({
          id: r.metadata.productId || 'unknown',
          content: r.content,
          score: r.score,
          metadata: {
            ...r.metadata,
            searchType: r.searchType,
            category: r.metadata.category || queryAnalysis.productCategory
          }
        }));
        
        allResults.push(...formattedResults);
        
        // Process products for display
        products = await this.processProductsForDisplay(productResults);
      } else {
        // If no specific category, use the original query
        const productResults = await vectorStorage.searchProducts(query, 8);
        
        console.log(`Found ${productResults.length} product results`);
        
        // Track search metrics
        productResults.forEach(result => {
          if (result.searchType === 'semantic') searchMetrics.semanticResults++;
          else if (result.searchType === 'keyword') searchMetrics.keywordResults++;
          else if (result.searchType === 'hybrid') searchMetrics.hybridResults++;
        });
        
        // Convert to SearchResult format
        const formattedResults = productResults.map(r => ({
          id: r.metadata.productId || 'unknown',
          content: r.content,
          score: r.score,
          metadata: {
            ...r.metadata,
            searchType: r.searchType
          }
        }));
        
        allResults.push(...formattedResults);
        
        // Process products for display
        products = await this.processProductsForDisplay(productResults);
      }
    }
    
    // Always search knowledge base for relevant information using hybrid search
    console.log('Performing hybrid knowledge base search...');
    const knowledgeResults = await vectorStorage.searchKnowledge(query, 5);
    console.log(`Found ${knowledgeResults.length} knowledge results`);
    
    // Track search metrics for knowledge
    knowledgeResults.forEach(result => {
      if (result.searchType === 'semantic') searchMetrics.semanticResults++;
      else if (result.searchType === 'keyword') searchMetrics.keywordResults++;
      else if (result.searchType === 'hybrid') searchMetrics.hybridResults++;
    });
    
    allResults.push(...knowledgeResults.map(r => ({
      id: r.metadata.parentId || 'unknown',
      content: r.content,
      score: r.score,
      metadata: {
        ...r.metadata,
        searchType: r.searchType
      }
    })));
    
    // If order-related, prepare order tracking context
    if (queryAnalysis.isOrderRelated) {
      retrievalStrategies.push('order_tracking');
      
      // Add order tracking instructions to context
      allResults.push({
        id: 'order_tracking_instructions',
        content: `To track an order, collect the customer's email address and order ID. Once you have both, inform the user that you'll check their order status.`,
        score: 0.9,
        metadata: {
          title: 'Order Tracking Instructions',
          source: 'system',
          searchType: 'keyword'
        }
      });
    }
    
    // Add personalization context if needed
    if (queryAnalysis.requiresPersonalization && memory.preferences) {
      retrievalStrategies.push('personalization');
      
      // Add user preferences to context
      allResults.push({
        id: 'user_preferences',
        content: `User preferences: ${JSON.stringify(memory.preferences)}`,
        score: 0.85,
        metadata: {
          title: 'User Preferences',
          source: 'session_memory',
          searchType: 'keyword'
        }
      });
    }
    
    // Add conversation context if available
    if (queryAnalysis.contextTypes.includes('conversation')) {
      retrievalStrategies.push('conversation');
      
      // Get recent conversation history
      const conversationHistory = await this.getConversationHistory(sessionId);
      if (conversationHistory.length > 0) {
        const recentContext = conversationHistory
          .slice(-3)
          .map(msg => `${msg.role}: ${msg.content}`)
          .join('\n');
        
        allResults.push({
          id: 'conversation_context',
          content: `Recent conversation context:\n${recentContext}`,
          score: 0.8,
          metadata: {
            title: 'Conversation History',
            source: 'conversation',
            searchType: 'keyword'
          }
        });
      }
    }
    
    // Calculate average score
    if (allResults.length > 0) {
      const totalScore = allResults.reduce((sum, result) => sum + result.score, 0);
      searchMetrics.averageScore = totalScore / allResults.length;
    }
    
    // Sort by relevance and return
    const sortedResults = allResults.sort((a, b) => b.score - a.score);
    
    console.log(`Retrieved ${sortedResults.length} total context items using strategies: ${retrievalStrategies.join(', ')}`);
    console.log('Search metrics:', searchMetrics);
    
    return {
      results: sortedResults,
      strategy: retrievalStrategies.join(', ') || 'general',
      products,
      searchMetrics
    };
  }

  /**
   * Process product results for display
   */
  private async processProductsForDisplay(productResults: any[]): Promise<any[]> {
    return productResults.map(result => ({
      title: result.metadata?.title || 'Unknown Product',
      description: result.content,
      price: result.metadata?.price ? parseFloat(String(result.metadata.price)) : 0,
      imageUrl: result.metadata?.imageUrl || null,
      productUrl: result.metadata?.productUrl || '#'
    }));
  }

  /**
   * Generate a response using multi-stage reasoning with the LLM
   */
  private async generateResponse(
    query: string,
    retrievedContext: {
      results: SearchResult[];
      strategy: string;
      products?: any[];
      searchMetrics?: {
        semanticResults: number;
        keywordResults: number;
        hybridResults: number;
        averageScore: number;
      };
    },
    conversationHistory: any[],
    queryAnalysis: any
  ): Promise<AgenticRAGResponse> {
    try {
      // Build context from retrieved results
      const context = this.buildContext(retrievedContext.results, queryAnalysis);
      
      // Generate system prompt
      const systemPrompt = this.buildSystemPrompt(queryAnalysis);
      
      // Prepare messages for the LLM with proper system message
      const messages = [
        { role: 'system', content: systemPrompt + '\n\n' + context },
        { role: 'user', content: query }
      ];
      
      // Add conversation history if available, but avoid duplicates
      if (conversationHistory.length > 0) {
        // Insert conversation history between system message and current query
        messages.splice(1, 0, ...conversationHistory.slice(-8));
      }
      
      // Log the actual messages being sent
      console.log(`Sending ${messages.length} messages to LLM for response generation:`, {
        systemMessage: messages.filter(m => m.role === 'system').length > 0,
        userMessages: messages.filter(m => m.role === 'user').length,
        assistantMessages: messages.filter(m => m.role === 'assistant').length,
        conversationHistoryLength: conversationHistory.length
      });
      
      // Generate response using the AI service
      const answer = await aiService.generateResponse(messages);
      
      // Calculate confidence score
      const confidence = this.calculateConfidence(retrievedContext.results, queryAnalysis);
      
      // Prepare sources information
      const sources = retrievedContext.results
        .filter(result => result.metadata?.title && result.metadata?.source !== 'system')
        .map(result => ({
          title: result.metadata?.title || 'Unknown Source',
          url: result.metadata?.sourceUrl || undefined
        }));
      
      return {
        answer,
        sources,
        confidence,
        products: retrievedContext.products,
        intent: queryAnalysis.intent,
        shouldStartProductFlow: queryAnalysis.shouldStartProductFlow,
        debug: {
          reasoning: queryAnalysis.reasoning,
          retrievalStrategy: retrievedContext.strategy,
          contextUsed: retrievedContext.results.map(r => r.metadata?.title || 'Unnamed context'),
          confidenceScore: confidence,
          productCategory: queryAnalysis.productCategory,
          searchMetrics: retrievedContext.searchMetrics
        }
      };
    } catch (error) {
      console.error('Error generating response:', error);
      
      // Return a graceful error response
      return {
        answer: "I'm sorry, I'm having trouble processing your request right now. Could you please try rephrasing your question?",
        sources: [],
        confidence: 0.3,
        intent: queryAnalysis.intent,
        shouldStartProductFlow: queryAnalysis.shouldStartProductFlow,
        debug: {
          reasoning: 'Error occurred during response generation',
          retrievalStrategy: retrievedContext.strategy,
          contextUsed: [],
          confidenceScore: 0.3,
          productCategory: queryAnalysis.productCategory,
          error: error instanceof Error ? error.message : 'Unknown error',
          searchMetrics: retrievedContext.searchMetrics
        }
      };
    }
  }

  /**
   * Build a comprehensive context for the LLM based on retrieved results
   */
  private buildContext(results: SearchResult[], queryAnalysis: any): string {
    if (results.length === 0) {
      return 'No specific information found. Provide general assistance based on your knowledge.';
    }
    
    let context = `Based on the user's query, here is the most relevant information:\n\n`;
    
    // Categorize results
    const productResults = results.filter(r => r.metadata?.productId);
    const knowledgeResults = results.filter(r => !r.metadata?.productId && r.metadata?.source !== 'system');
    const systemResults = results.filter(r => r.metadata?.source === 'system');
    const conversationResults = results.filter(r => r.metadata?.source === 'conversation');
    
    // Add product information if available
    if (productResults.length > 0) {
      context += `PRODUCT INFORMATION:\n`;
      productResults.slice(0, 3).forEach((result, index) => {
        context += `${index + 1}. Product: ${result.metadata?.title || 'Unknown Product'}\n`;
        context += `   Description: ${result.content.substring(0, 150)}${result.content.length > 150 ? '...' : ''}\n`;
        if (result.metadata?.price) context += `   Price: ${result.metadata.price}\n`;
        if (result.metadata?.category) context += `   Category: ${result.metadata.category}\n`;
        context += '\n';
      });
    }
    
    // Add knowledge base information if available
    if (knowledgeResults.length > 0) {
      context += `KNOWLEDGE BASE INFORMATION:\n`;
      knowledgeResults.slice(0, 3).forEach((result, index) => {
        context += `${index + 1}. ${result.metadata?.title || 'Information'}:\n`;
        context += `   ${result.content.substring(0, 200)}${result.content.length > 200 ? '...' : ''}\n\n`;
      });
    }
    
    // Add conversation context if available
    if (conversationResults.length > 0) {
      context += `CONVERSATION CONTEXT:\n`;
      conversationResults.forEach((result, index) => {
        context += `${index + 1}. ${result.metadata?.title || 'Context'}:\n`;
        context += `   ${result.content}\n\n`;
      });
    }
    
    // Add system instructions if available
    if (systemResults.length > 0) {
      context += `SYSTEM INSTRUCTIONS:\n`;
      systemResults.forEach((result, index) => {
        context += `${index + 1}. ${result.metadata?.title || 'Instruction'}:\n`;
        context += `   ${result.content}\n\n`;
      });
    }
    
    // Add guidance based on query analysis
    context += `RESPONSE GUIDANCE:\n`;
    
    if (queryAnalysis.isProductRelated) {
      context += `- This query relates to products or shopping. `;
      
      // Include product category if available
      if (queryAnalysis.productCategory) {
        context += `The user is specifically looking for ${queryAnalysis.productCategory} products. `;
      }
      
      if (Object.keys(queryAnalysis.explicitPreferences).length > 0) {
        context += `Consider these user preferences: ${JSON.stringify(queryAnalysis.explicitPreferences)}.\n`;
      } else {
        context += `Focus on understanding their needs and preferences before making recommendations.\n`;
      }
    }
    
    if (queryAnalysis.isOrderRelated) {
      context += `- This query relates to orders or tracking. Collect any necessary information in a conversational way.\n`;
    }
    
    context += `- Response depth: ${queryAnalysis.complexity}/5. ${
      queryAnalysis.complexity >= 4 
        ? 'Provide a comprehensive response that addresses the query in detail.' 
        : 'Keep your response helpful but concise, focusing on the most relevant information.'
    }\n`;
    
    context += `\nUse this information to provide a helpful, accurate response to the user's query. If the information doesn't fully address their query, use your general knowledge but prioritize the provided information.`;
    
    return context;
  }

  /**
   * Build a system prompt based on query analysis
   */
  private buildSystemPrompt(queryAnalysis: any): string {
    let prompt = `You are a helpful customer service assistant for KarjiStore. Be friendly, professional, and CONVERSATIONAL.

CRITICAL RESPONSE GUIDELINES:
- Keep responses SHORT and CONCISE (1-2 sentences maximum)
- Ask only ONE question at a time, not multiple questions
- NEVER list product details in text format - products should only be shown as cards
- Focus on conversational flow and natural dialogue
- Be warm and engaging but brief

CONVERSATIONAL FLOW:
- Ask ONE clarifying question at a time
- Wait for user response before asking the next question
- Build context gradually through conversation
- Use natural transitions between topics
- Maintain conversation state and context

STEP-BY-STEP PREFERENCE COLLECTION:
- Start with basic category/gender if not specified
- Then ask about style preference (classic, modern, sporty, elegant)
- Then ask about budget range
- Then ask about specific features if needed
- NEVER ask all preferences at once

PRODUCT DISPLAY RULES:
- NEVER describe products in text format
- Products should ONLY be displayed as cards/buttons
- If products are available, show them as cards without text descriptions
- Keep product recommendations brief and focused

CONVERSATION MEMORY:
- ALWAYS consider the conversation history
- Remember what the user has already told you
- Build on previous responses
- Don't repeat questions already answered
- Use context from the conversation history

PREFERENCE COLLECTION BEFORE PRODUCTS:
- NEVER show products until you have collected sufficient preferences
- For generic queries like "women watches", ask about style first
- For "classic" responses, ask about budget next
- Only show products after collecting style AND budget preferences
- If user gives multiple preferences at once, acknowledge them and ask for the next one

MANDATORY RULES:
- If user asks for "women watches" → Ask for style preference ONLY
- If user says "classic" → Ask for budget preference ONLY  
- If user gives budget → Show products ONLY if style was already collected
- NEVER show products for generic queries without collecting preferences first
- NEVER ask multiple questions at once
- ALWAYS build conversation step by step

EXAMPLES OF GOOD RESPONSES:
✅ "Great! I found some women's watches for you. What style are you looking for - classic, modern, or sporty?"
✅ "Perfect! Now what's your budget range?"
✅ "Here are some elegant watches in your price range: [product cards]"
❌ "I have many watches. What's your style, budget, features, occasion, and brand preference?"
❌ "Here's a detailed description of each watch with specifications..."
❌ Showing products without asking preferences first`;

    // Add product-specific instructions if needed
    if (queryAnalysis.isProductRelated) {
      prompt += `\n\nPRODUCT RECOMMENDATION GUIDELINES:
- Ask ONE preference question at a time (style, budget, features)
- NEVER describe products in text - only show as cards
- Build context gradually through conversation
- Show products only when you have sufficient preferences
- Keep responses under 2 sentences
- Focus on natural dialogue flow

MANDATORY PREFERENCE COLLECTION:
- For "women watches" → Ask about style first
- For "classic" → Ask about budget next  
- For "200-500" → Show products
- NEVER skip preference collection steps
- NEVER show products for generic queries without preferences`;
    }

    // Add order-specific instructions if needed
    if (queryAnalysis.isOrderRelated) {
      prompt += `\n\nORDER HANDLING:
- To track orders, you need the customer's email and order number
- Order statuses include: pending, processing, shipped, delivered, and cancelled
- For order issues, collect the necessary information in a conversational way
- Be empathetic when handling order issues or delays`;
    }

    return prompt;
  }

  /**
   * Calculate confidence score based on retrieved results and query analysis
   */
  private calculateConfidence(results: SearchResult[], queryAnalysis: any): number {
    if (results.length === 0) return 0.5;
    
    // Calculate average score of top 3 results
    const topScores = results.slice(0, 3).map(result => result.score);
    const avgScore = topScores.reduce((sum, score) => sum + score, 0) / topScores.length;
    
    // Adjust based on query complexity
    const complexityFactor = 1 - (queryAnalysis.complexity - 1) / 10; // 1.0 to 0.6
    
    // Calculate final confidence
    const confidence = Math.min(0.95, avgScore * complexityFactor);
    
    return Math.max(0.5, confidence); // Minimum confidence of 0.5
  }

  /**
   * Initialize session memory for a new session
   */
  private initializeSessionMemory(sessionId: string): void {
    if (!this.sessionMemory.has(sessionId)) {
      this.sessionMemory.set(sessionId, {
        preferences: {},
        recentQueries: [],
        contextHistory: [],
        productInteractions: [],
        lastQueryTimestamp: new Date(),
        conversationFlow: {
          currentState: 'idle',
          collectedInfo: {},
          pendingQuestions: []
        },
        userProfile: {
          name: 'Guest',
          email: undefined,
          preferences: {
            budget: undefined,
            style: undefined,
            occasion: undefined,
            category: undefined,
            gender: undefined,
            brand: []
          },
          interactionHistory: []
        }
      });
    }
  }

  /**
   * Update session memory with new information from the current interaction
   */
  private updateSessionMemory(
    sessionId: string,
    query: string,
    queryAnalysis: any,
    response: AgenticRAGResponse
  ): void {
    const memory = this.sessionMemory.get(sessionId);
    if (!memory) return;
    
    // Update preferences with any explicit preferences from the query
    if (queryAnalysis.explicitPreferences && Object.keys(queryAnalysis.explicitPreferences).length > 0) {
      memory.preferences = {
        ...memory.preferences,
        ...queryAnalysis.explicitPreferences
      };
    }
    
    // Add query to recent queries
    memory.recentQueries = [...(memory.recentQueries || []), query].slice(-5);
    
    // Update timestamp
    memory.lastQueryTimestamp = new Date();
    
    // Update product interactions if products were shown
    if (response.products && response.products.length > 0) {
      memory.productInteractions = [
        ...(memory.productInteractions || []),
        {
          timestamp: new Date(),
          query,
          products: response.products.map(p => p.title)
        }
      ].slice(-10);
    }

    // Update conversation flow
    memory.conversationFlow = {
      ...memory.conversationFlow,
      currentState: response.intent || 'idle',
      collectedInfo: {
        ...memory.conversationFlow?.collectedInfo,
        ...queryAnalysis.explicitPreferences
      },
      pendingQuestions: response.intent === 'product_recommendation' || response.intent === 'product_search' 
        ? [] 
        : (memory.conversationFlow?.pendingQuestions || []),
    };

    // Update user profile interaction history
    memory.userProfile = {
      ...memory.userProfile,
      preferences: memory.userProfile?.preferences || {
        budget: undefined,
        style: undefined,
        occasion: undefined,
        category: undefined,
        brand: []
      },
      interactionHistory: [
        ...memory.userProfile?.interactionHistory || [],
        {
          timestamp: new Date(),
          query,
          response: response.answer,
          productsViewed: response.products?.map(p => p.title) || [],
          intent: response.intent || 'other'
        }
      ].slice(-10)
    };
    
    this.sessionMemory.set(sessionId, memory);
  }

  /**
   * Get conversation history for a session
   */
  private async getConversationHistory(sessionId: string): Promise<{ role: string; content: string }[]> {
    try {
      // Get the last few messages from the conversation history
      const chatHistory = await vectorStorage.getChatHistory(sessionId);
      
      console.log(`Retrieved ${chatHistory.length} messages from history for session ${sessionId}`);
      
      // Convert to the format expected by the AI service
      const messages = chatHistory
        .slice(-8) // Get the last 8 messages for context
        .map(msg => ({
          role: msg.isBot ? 'assistant' : 'user',
          content: msg.content
        }));
      
      console.log(`Using ${messages.length} messages for conversation context:`, 
        messages.map(m => `${m.role}: ${m.content.substring(0, 50)}...`));
      
      return messages;
    } catch (error) {
      console.error('Error getting conversation history:', error);
      return [];
    }
  }

  /**
   * Save conversation messages to storage
   */
  private async saveConversationMessages(userMessage: string, botResponse: string, sessionId: string): Promise<void> {
    try {
      // Save user message
      await vectorStorage.saveChatMessage(sessionId, {
        content: userMessage,
        isBot: false
      });
      
      // Save bot response
      await vectorStorage.saveChatMessage(sessionId, {
        content: botResponse,
        isBot: true
      });
    } catch (error) {
      console.error('Error saving conversation messages:', error);
    }
  }

  /**
   * Add a knowledge document to the vector storage
   */
  async addKnowledgeDocument(
    title: string, 
    content: string, 
    type: string,
    sourceUrl?: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    try {
      // Use the vector storage directly to add the knowledge document
      const knowledgeItem = await vectorStorage.addKnowledgeBase({
        title,
        content,
        type,
        sourceUrl,
        metadata
      });
      
      console.log(`Added knowledge document: ${title}`);
      return knowledgeItem.vectorId || '';
    } catch (error) {
      console.error('Error adding knowledge document:', error);
      throw error;
    }
  }

  /**
   * Add a product to the vector storage
   */
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
      // Use the vector storage directly to add the product
      await vectorStorage.addProduct(productData);
      console.log(`Added product: ${productData.title}`);
    } catch (error) {
      console.error('Error adding product:', error);
      throw error;
    }
  }

  /**
   * Initialize the knowledge base with comprehensive KarjiStore information
   */
  async initializeKnowledgeBase(): Promise<void> {
    try {
      console.log('Initializing knowledge base with KarjiStore information...');
      
      const knowledgeItems = [
        {
          title: "About KarjiStore",
          content: "Welcome to KarjiStore, your number one source for all perfumes, accessories, and makeup. We're dedicated to giving you the very best of everything. The Karji Perfumes first store opened in 1999 and today we feel proud to serve our prestigious customers with more than twenty branches all over the United Arab Emirates and still counting more. Karji reputation is built from customer satisfaction and loyalty, by providing a personal boutique service to our customers.",
          type: "company_info"
        },
        {
          title: "Product Categories",
          content: "KarjiStore specializes in premium perfumes, watches, and luxury gifts. Our product categories include: 1) Perfumes - Designer fragrances, niche perfumes, and exclusive scents from top brands like Calvin Klein, La Maison, Billie Eilish, and Penhaligon. 2) Watches - Luxury timepieces from renowned brands, including both affordable and high-end options. 3) Jewelry - Elegant jewelry pieces and accessories. 4) Gift Sets - Curated gift collections perfect for special occasions.",
          type: "product_info"
        },
        {
          title: "Shipping and Delivery",
          content: "We offer international shipping to most countries. Standard delivery takes 3-5 business days within UAE and 7-14 days for international orders. Express shipping is available for urgent orders. All orders are carefully packaged to ensure your items arrive in perfect condition. You can track your order using your order number and email address.",
          type: "shipping_info"
        },
        {
          title: "Return Policy",
          content: "We have a 30-day return policy for all products. Items must be in original condition with all packaging intact. Returns are free for defective items. For change of mind returns, shipping costs may apply. Contact our customer service team to initiate a return. We process refunds within 5-7 business days after receiving the returned item.",
          type: "return_policy"
        },
        {
          title: "Order Tracking",
          content: "To track your order, you'll need your order number and the email address used during checkout. You can check your order status on our website or contact our customer service team. Order statuses include: Pending (order received), Processing (being prepared), Shipped (on its way), Out for Delivery (with courier), and Delivered (successfully delivered).",
          type: "order_info"
        },
        {
          title: "Customer Service",
          content: "Our customer service team is available to help you with any questions about our products, orders, or policies. You can reach us through our website chat, email, or phone. We're committed to providing excellent service and ensuring your complete satisfaction with every purchase.",
          type: "customer_service"
        },
        {
          title: "Perfume Selection Guide",
          content: "When choosing a perfume, consider: 1) Fragrance family (floral, woody, fresh, oriental) - what appeals to you? 2) Occasion (daily wear, special events, work) - different scents suit different situations. 3) Season (light florals for spring/summer, warm orientals for fall/winter). 4) Personal style (classic, modern, bold, subtle). 5) Budget - we offer options from affordable to luxury. Our experts can help you find the perfect scent based on your preferences.",
          type: "perfume_guide"
        },
        {
          title: "Watch Selection Guide",
          content: "When selecting a watch, consider: 1) Style preference (classic, sporty, luxury, minimalist). 2) Functionality needs (basic time, chronograph, water resistance). 3) Occasion (daily wear, formal events, sports). 4) Brand preference (we carry renowned luxury and designer brands). 5) Budget range (we offer watches from affordable to high-end luxury). Our collection includes both automatic and quartz movements.",
          type: "watch_guide"
        },
        {
          title: "Gift Recommendations",
          content: "For gift-giving, consider: 1) Recipient's personality and style preferences. 2) Occasion (birthday, anniversary, holiday, corporate). 3) Budget range (we have options for every price point). 4) Personalization options (engraving, custom packaging). 5) Gift sets (curated collections that make perfect gifts). Popular gift categories include: luxury perfumes, elegant watches, and premium gift sets.",
          type: "gift_guide"
        },
        {
          title: "Payment Options",
          content: "We accept all major credit cards (Visa, MasterCard, American Express), PayPal, and bank transfers. All transactions are secure and encrypted. We also offer installment payment plans for larger purchases. Prices are displayed in UAE Dirhams (AED) and we accept international currencies with automatic conversion.",
          type: "payment_info"
        },
        {
          title: "Store Locations",
          content: "KarjiStore has over twenty branches across the United Arab Emirates, including locations in Dubai, Abu Dhabi, Sharjah, and other major cities. Each store offers the same premium service and product selection. You can visit any location to see our products in person, get personalized recommendations, and enjoy our boutique shopping experience.",
          type: "store_info"
        },
        {
          title: "Product Authenticity",
          content: "All products sold at KarjiStore are 100% authentic and sourced directly from authorized distributors and manufacturers. We provide authenticity guarantees with every purchase. Our products come with original packaging and manufacturer warranties. We never sell counterfeit or replica items.",
          type: "authenticity_info"
        }
      ];
      
      // Add each knowledge item to the vector storage
      for (const item of knowledgeItems) {
        await this.addKnowledgeDocument(
          item.title,
          item.content,
          item.type
        );
      }
      
      console.log(`✓ Successfully initialized knowledge base with ${knowledgeItems.length} items`);
    } catch (error) {
      console.error('Error initializing knowledge base:', error);
      throw error;
    }
  }

  /**
   * Get user preferences from session memory
   */
  getUserPreferences(sessionId: string): Record<string, any> {
    const memory = this.sessionMemory.get(sessionId);
    return memory?.userProfile?.preferences || {};
  }

  /**
   * Update user preferences
   */
  updateUserPreferences(sessionId: string, preferences: Record<string, any>): void {
    const memory = this.sessionMemory.get(sessionId);
    if (memory && memory.userProfile) {
      memory.userProfile.preferences = {
        ...memory.userProfile.preferences,
        ...preferences
      };
      this.sessionMemory.set(sessionId, memory);
    }
  }

  /**
   * Get conversation history with context
   */
  getConversationContext(sessionId: string): {
    recentQueries: string[];
    productInteractions: any[];
    userPreferences: Record<string, any>;
    conversationFlow: any;
  } {
    const memory = this.sessionMemory.get(sessionId);
    return {
      recentQueries: memory?.recentQueries || [],
      productInteractions: memory?.productInteractions || [],
      userPreferences: memory?.userProfile?.preferences || {},
      conversationFlow: memory?.conversationFlow || { currentState: 'idle', collectedInfo: {}, pendingQuestions: [] }
    };
  }

  /**
   * Check if a query is a follow-up question
   */
  private isFollowUpQuestion(query: string, conversationHistory: any[]): boolean {
    if (conversationHistory.length === 0) return false;
    
    const lowerQuery = query.trim().toLowerCase();
    const isShortQuery = lowerQuery.split(/\s+/).length <= 5;
    
    // Check for follow-up indicators
    const followUpIndicators = [
      'show me', 'what about', 'how about', 'do you have', 'can you show',
      'cheaper', 'more expensive', 'different', 'other', 'else', 'sure', 'yes',
      'okay', 'ok', 'sounds good', 'please', 'go ahead', 'continue', 'proceed',
      'i want', 'i like', 'i prefer', 'tell me more', 'more info'
    ];
    
    const hasFollowUpIndicator = followUpIndicators.some(indicator => 
      lowerQuery.includes(indicator)
    );
    
    // Check if previous messages were product-related
    const hasProductContext = conversationHistory
      .slice(-3)
      .some(msg => 
        msg.content.toLowerCase().includes('product') || 
        msg.content.toLowerCase().includes('perfume') ||
        msg.content.toLowerCase().includes('fragrance') ||
        msg.content.toLowerCase().includes('recommend') ||
        msg.content.toLowerCase().includes('suggest') ||
        msg.content.toLowerCase().includes('show you')
      );
    
    // Check if the query is a direct answer to a previous question
    const lastBotMessage = conversationHistory.filter(msg => msg.role === 'assistant').pop();
    let isAnswerToQuestion = false;
    
    if (lastBotMessage) {
      const lastBotMessageLower = lastBotMessage.content.toLowerCase();
      
      // Check if the last bot message was a question
      const isQuestion = lastBotMessageLower.includes('?');
      
      if (isQuestion) {
        // Check for direct answers to common questions about preferences
        
        // For style questions
        if (lastBotMessageLower.includes('style') || lastBotMessageLower.includes('type')) {
          const styleOptions = ['floral', 'woody', 'fresh', 'oriental', 'spicy', 'citrus', 'fruity', 
                              'sweet', 'musky', 'classic', 'modern', 'sporty', 'casual', 'elegant'];
          if (styleOptions.some(style => lowerQuery === style || lowerQuery.includes(style))) {
            isAnswerToQuestion = true;
            console.log(`Detected direct style answer: "${query}" to question`);
          }
        }
        
        // For gender questions
        if (lastBotMessageLower.includes('men') || lastBotMessageLower.includes('women') || 
            lastBotMessageLower.includes('gender')) {
          const genderOptions = ['men', 'women', 'male', 'female', 'unisex', 'for men', 'for women'];
          if (genderOptions.some(gender => lowerQuery === gender || lowerQuery.includes(gender))) {
            isAnswerToQuestion = true;
            console.log(`Detected direct gender answer: "${query}" to question`);
          }
        }
        
        // For occasion questions
        if (lastBotMessageLower.includes('occasion')) {
          const occasionOptions = ['everyday', 'daily', 'special', 'casual', 'formal', 'work', 'date', 'evening'];
          if (occasionOptions.some(occasion => lowerQuery === occasion || lowerQuery.includes(occasion))) {
            isAnswerToQuestion = true;
            console.log(`Detected direct occasion answer: "${query}" to question`);
          }
        }
        
        // For budget questions
        if (lastBotMessageLower.includes('budget') || lastBotMessageLower.includes('price')) {
          const budgetOptions = ['cheap', 'expensive', 'affordable', 'luxury', 'premium', 'under', 'less than', 'around'];
          if (budgetOptions.some(budget => lowerQuery === budget || lowerQuery.includes(budget)) || 
              /\d+/.test(lowerQuery)) {
            isAnswerToQuestion = true;
            console.log(`Detected direct budget answer: "${query}" to question`);
          }
        }
        
        // For product type questions
        if (lastBotMessageLower.includes('looking for') || lastBotMessageLower.includes('interested in')) {
          const productOptions = ['perfume', 'fragrance', 'cologne', 'watch', 'jewelry', 'gift'];
          if (productOptions.some(product => lowerQuery === product || lowerQuery.includes(product))) {
            isAnswerToQuestion = true;
            console.log(`Detected direct product type answer: "${query}" to question`);
          }
        }
        
        // For very short responses that are likely answers
        if (isShortQuery && lowerQuery.split(/\s+/).length <= 2) {
          isAnswerToQuestion = true;
          console.log(`Detected likely answer due to very short query: "${query}"`);
        }
      }
    }
      
    return (isShortQuery || hasFollowUpIndicator || isAnswerToQuestion) && hasProductContext;
  }

  /**
   * Extract preferences from user query using LLM
   */
  private async extractPreferencesFromQuery(query: string): Promise<Record<string, any>> {
    try {
      // Skip extraction for very short queries that are likely follow-ups
      if (query.trim().split(/\s+/).length <= 2) {
        console.log('Skipping preference extraction for short query:', query);
        return {};
      }
      
      const extractionPrompt = `
You are a product preference extraction system for a luxury retail store called KarjiStore.
Analyze the user's query and extract their shopping preferences and intent.

Extract user preferences from this query. Return only a JSON object with these fields:
- budget: string (e.g., "under 200", "luxury", "affordable", "500 AED")
- style: string (e.g., "classic", "modern", "bold", "subtle", "floral", "woody")
- occasion: string (e.g., "daily wear", "special occasion", "gift", "birthday")
- category: string (e.g., "perfume", "watch", "jewelry", "gift")
- gender: string (e.g., "women", "men", "unisex")
- brand: array of strings (e.g., ["Calvin Klein", "La Maison"])

Be very precise about the product category. For example:
- "show me watches for women" → category: "watch", gender: "women"
- "men's cologne" → category: "perfume", gender: "men"
- "ladies jewelry" → category: "jewelry", gender: "women"

For budget constraints, standardize them as follows:
- "under 200" → budget: "under 200"
- "less than 300" → budget: "under 300"
- "between 100 and 500" → budget: "between 100 and 500"
- "over 1000" → budget: "over 1000"
- "affordable" → budget: "budget-friendly"
- "luxury" → budget: "premium"
- "mid-range" → budget: "mid-range"

If the query is a direct answer to a question (like "floral", "men", "everyday"), interpret it in context:
- If it's a style (floral, woody, fresh, etc.), set style field
- If it's a gender (men, women, unisex), set gender field
- If it's an occasion (everyday, special, casual), set occasion field

Query: "${query}"

If no specific preference is mentioned, leave that field as an empty string or empty array.
Return only the JSON object:
`;

      const messages = [
        { role: 'system', content: extractionPrompt },
        { role: 'user', content: query }
      ];

      const response = await aiService.generateResponse(messages);
      
      console.log('Preference extraction response:', response);
      
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const preferences = JSON.parse(jsonMatch[0]);
        
        // Filter out empty values
        const filteredPreferences: Record<string, any> = {};
        Object.entries(preferences).forEach(([key, value]) => {
          if (value && (typeof value === 'string' ? value.trim() !== '' : true)) {
            filteredPreferences[key] = value;
          }
        });
        
        console.log('Extracted preferences:', filteredPreferences);
        return filteredPreferences;
      }
      
      return {};
    } catch (error) {
      console.error('Error extracting preferences:', error);
      return {};
    }
  }
}

// Create and export an instance of the AgenticRAGService
export const agenticRagService = new AgenticRAGService(); 