import { vectorStorage } from './vector-storage';
import { aiService } from './ai-service';
import { storage } from '../storage';
import fs from 'fs';
import path from 'path';

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

export interface RAGResponse {
  answer: string;
  sources: SearchResult[];
  confidence: number;
  intent?: string;
  shouldStartProductFlow?: boolean;
  products?: Array<{
    title: string;
    description: string;
    price: number;
    imageUrl: string | null;
    productUrl: string;
  }>;
  orderData?: any; // Added for order tracking data
}

export class RAGService {
  async query(userQuery: string, sessionId: string): Promise<RAGResponse> {
    try {
      // Analyze the query intent
      const queryAnalysis = await this.analyzeQueryIntentWithAI(userQuery, sessionId);
      console.log(`Query intent analysis: ${queryAnalysis.intent}, shouldStartProductFlow: ${queryAnalysis.shouldStartProductFlow}`);
      
      // Search for relevant content based on the query and intent
      const searchResults = await this.searchRelevantContent(userQuery, queryAnalysis.intent);
      console.log(`Found ${searchResults.length} search results`);
      
      // Generate a contextual response based on the search results
      const answer = await this.generateContextualResponse(userQuery, searchResults, sessionId, queryAnalysis);
      console.log(`Generated response: ${answer.substring(0, 100)}...`);
      
      // Calculate confidence score
      const confidence = this.calculateConfidence(searchResults);
      console.log(`Confidence score: ${confidence}`);
      
      // For product search intent, extract product information from search results
      let products;
      if (queryAnalysis.intent === 'product_search') {
        products = searchResults
          .filter(result => result.metadata?.productId)
          .map(result => ({
            title: result.metadata?.title || 'Unknown Product',
            description: result.content,
            price: result.metadata?.price ? parseFloat(result.metadata.price) : 0,
            imageUrl: result.metadata?.imageUrl || null,
            productUrl: result.metadata?.productUrl || '#'
          }));
        console.log(`Extracted ${products.length} products from search results`);
      }
      
      // Store the message in the conversation history
      await vectorStorage.saveChatMessage(sessionId, {
        content: userQuery,
        isBot: false
      });
      
      await vectorStorage.saveChatMessage(sessionId, {
        content: answer,
        isBot: true
      });
      
      return {
        answer,
        sources: searchResults,
        confidence,
        intent: queryAnalysis.intent,
        shouldStartProductFlow: queryAnalysis.shouldStartProductFlow,
        products
      };
    } catch (error) {
      console.error('Error in RAG query:', error);
      
      // Store the user message in the conversation history
      await vectorStorage.saveChatMessage(sessionId, {
        content: userQuery,
        isBot: false
      });
      
      // Store a fallback response
      const fallbackResponse = "I'm currently experiencing some technical difficulties. Please try again later or contact our support team for assistance. If you're an administrator, please check the AI configuration in the admin panel.";
      
      await vectorStorage.saveChatMessage(sessionId, {
        content: fallbackResponse,
        isBot: true
      });
      
      // Return a fallback response
      return {
        answer: fallbackResponse,
        sources: [],
        confidence: 0,
        intent: 'error',
        shouldStartProductFlow: false
      };
    }
  }

  private async analyzeQueryIntentWithAI(query: string, sessionId: string): Promise<{ intent: string; shouldStartProductFlow: boolean }> {
    try {
      // Get conversation history for better context
      const conversationHistory = await this.getConversationHistory(sessionId);
      
      // Use AI to analyze intent
      const intentPrompt = `Analyze the following user query and conversation history to determine the user's intent.
Respond with a single word or short phrase that best categorizes the intent from these options:
- greeting (just saying hello)
- product_search (looking for specific products)
- product_recommendation (asking for product suggestions)
- order_tracking (asking about order status)
- support (general help or questions)
- other (anything else)

Also indicate if the query should start a product recommendation flow (true/false).

Format your response exactly like this example:
greeting, shouldStartProductFlow: false

User Query: "${query}"

Conversation History:
${conversationHistory.slice(-4).map(msg => `${msg.role}: ${msg.content}`).join('\n')}`;

      // Prepare messages for AI
      const messages = [
        {
          role: 'user',
          content: intentPrompt
        }
      ];
      
      // Generate response using AI service
      const response = await aiService.generateResponse(messages);
      
      // Check if the response contains configuration error messages
      if (response.includes("OpenRouter integration is not properly configured") || 
          response.includes("placeholder API key") ||
          response.includes("API key is invalid or has expired")) {
        console.log("Detected configuration error in AI response during intent analysis");
        // Use fallback analysis
        return this.fallbackIntentAnalysis(query);
      }
      
      // Parse the response
      let intent = 'other';
      let shouldStartProductFlow = false;
      
      // Extract the intent from the response
      const intentMatch = response.match(/^([a-z_]+)/i);
      if (intentMatch) {
        intent = intentMatch[1].toLowerCase();
      }
      
      // Extract the shouldStartProductFlow value
      const flowMatch = response.match(/shouldStartProductFlow:\s*(true|false)/i);
      if (flowMatch) {
        shouldStartProductFlow = flowMatch[1].toLowerCase() === 'true';
      }
      
      return { intent, shouldStartProductFlow };
    } catch (error) {
      console.error('Error analyzing query intent with AI:', error);
      // Use fallback intent analysis if AI fails
      return this.fallbackIntentAnalysis(query);
    }
  }

  private fallbackIntentAnalysis(query: string): { intent: string; shouldStartProductFlow: boolean } {
    const lowerQuery = query.toLowerCase().trim();
    
    // Check for recommendation keywords FIRST (higher priority)
    if (lowerQuery.includes('recommend') || 
        lowerQuery === 'recommendations' ||
        lowerQuery === 'suggestion' ||
        lowerQuery === 'suggestions' ||
        lowerQuery.includes('suggest') || 
        lowerQuery.includes('recommendation') ||
        lowerQuery.includes('what should i') ||
        lowerQuery.includes('help me find') ||
        lowerQuery.includes('looking for something') ||
        lowerQuery.includes('what do you have') ||
        lowerQuery.includes('show me') ||
        lowerQuery.includes('product') ||
        lowerQuery.includes('buy') ||
        lowerQuery.includes('purchase') ||
        lowerQuery.includes('shopping') ||
        (lowerQuery.includes('can you') && lowerQuery.includes('something'))) {
      return { intent: 'product_recommendation', shouldStartProductFlow: true };
    }
    
    // Check for common product categories
    const productCategories = ['dates', 'chocolate', 'sweet', 'coffee', 'vegetable'];
    if (productCategories.some(category => lowerQuery.includes(category))) {
      return { intent: 'product_search', shouldStartProductFlow: false };
    }
    
    // Greeting patterns - only pure greetings
    if (lowerQuery.match(/^(hi|hello|hey|good\s+(morning|afternoon|evening))$/)) {
      return { intent: 'greeting', shouldStartProductFlow: false };
    }
    
    // Check for "how are you" separately as it's often combined with other intents
    if (lowerQuery === 'how are you' || lowerQuery === 'how are you?') {
      return { intent: 'greeting', shouldStartProductFlow: false };
    }
    
    // Order tracking
    if (lowerQuery.includes('order') && (lowerQuery.includes('track') || lowerQuery.includes('status'))) {
      return { intent: 'order_tracking', shouldStartProductFlow: false };
    }
    
    // Affirmative responses that might be product-related in context
    if (lowerQuery === 'yes' || lowerQuery === 'yeah' || lowerQuery === 'sure' || 
        lowerQuery === 'ok' || lowerQuery === 'okay' || lowerQuery === 'please' || 
        lowerQuery === 'i do' || lowerQuery === 'i would') {
      // Without context, we'll assume it might be product-related
      return { intent: 'product_recommendation', shouldStartProductFlow: true };
    }
    
    // Direct product search - short queries that might be product names
    if (lowerQuery.length < 20 && !lowerQuery.includes('?') && !lowerQuery.includes('help')) {
      return { intent: 'product_search', shouldStartProductFlow: false };
    }
    
    return { intent: 'general_question', shouldStartProductFlow: false };
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
      if (intent === 'product_recommendation' || intent === 'product_search' || intent === 'general_question') {
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
    queryAnalysis: { intent: string; shouldStartProductFlow: boolean }
  ): Promise<string> {
    
    try {
      // Get conversation history
      const conversationHistory = await this.getConversationHistory(sessionId);
      
      // Build context from search results
      const context = this.buildContextFromResults(searchResults, queryAnalysis.intent);
      
      // Get the appropriate system prompt based on intent
      const systemPrompt = this.getSystemPromptForIntent(queryAnalysis.intent);
      
      // Add context information to the system prompt
      const enhancedSystemPrompt = `${systemPrompt}\n\nContext information: ${context}`;
      
      // Add conversation history to provide context for the AI
      // Include more recent messages for better context awareness
      const recentMessages = conversationHistory.slice(-8); // Last 8 messages for better context
      const messages = [
        ...recentMessages,
        { role: 'user', content: query }
      ];
      
      // Generate a response using the AI service
      const response = await aiService.generateResponse(messages, enhancedSystemPrompt);
      
      return response;
    } catch (error) {
      console.error('Error generating contextual response:', error);
      return "I apologize, but I'm having trouble generating a response right now. Please try again later.";
    }
  }

  private getSystemPromptForIntent(intent: string): string {
    const basePrompt = `You are a helpful customer service assistant for KarjiStore. Be friendly, professional, and CONVERSATIONAL. Engage in natural dialogue and ask follow-up questions to better understand customer needs.`;
    
    switch (intent) {
      case 'greeting':
        return `${basePrompt} 
Respond to greetings warmly and ask how you can help them today. Be conversational and friendly.
Example: "Hello! Welcome to KarjiStore. How can I assist you today? Are you looking for something specific or just browsing?"`;
      
      case 'product_recommendation':
        return `${basePrompt} 
The user is interested in product recommendations. 

IMPORTANT CONVERSATIONAL GUIDELINES:
1. Acknowledge their interest warmly and personally
2. Ask 1-2 follow-up questions to better understand their preferences
3. Be conversational and natural, not robotic
4. Show you're thinking about their specific needs
5. Don't just list products - engage in dialogue

EXAMPLES OF GOOD FOLLOW-UPS:
- "That sounds great! What's your budget range for this?"
- "I'd love to help you find the perfect gift. What's the occasion?"
- "Excellent choice! Do you prefer something classic or more modern?"
- "Perfect! Are you looking for something for yourself or as a gift?"
- "That's a wonderful idea! What's your preferred style - elegant, casual, or luxury?"

DO NOT list specific products in your response - they will be displayed separately as product cards.
Keep your response conversational and engaging, focusing on understanding their needs better.`;
      
      case 'product_search':
        return `${basePrompt} 
The user is searching for specific products.

IMPORTANT CONVERSATIONAL GUIDELINES:
1. Acknowledge their search warmly
2. Ask follow-up questions to refine their search
3. Show you understand their needs
4. Be helpful and conversational

EXAMPLES OF GOOD FOLLOW-UPS:
- "Great choice! What's your preferred price range?"
- "Excellent! Do you have a specific style in mind?"
- "Perfect! Are you looking for something for a special occasion?"
- "That's a great selection! What's your budget?"
- "Wonderful! Do you prefer a specific brand or are you open to options?"

DO NOT list specific products - they will be displayed separately as product cards.
Keep your response conversational and helpful, focusing on understanding their preferences better.`;
      
      case 'order_tracking':
        return `${basePrompt} The user wants to track an order. Briefly explain you need their email and order ID. Be helpful and reassuring.`;
      
      case 'support':
        return `${basePrompt} Provide helpful information concisely. Maximum 3 sentences. Ask if they need anything else.`;
      
      default:
        return `${basePrompt} 
Answer conversationally in 1-3 sentences maximum. 
Ask a follow-up question to better understand their needs and keep the conversation flowing naturally.
Examples: "What's your budget for this?" "What's the occasion?" "Do you have a preferred style?"`;
    }
  }

  private buildContextFromResults(results: SearchResult[], intent: string): string {
    if (results.length === 0) {
      return 'No specific information found. Provide general assistance based on your knowledge. Be conversational and ask follow-up questions to understand their needs better.';
    }
    
    // For product-related intents, handle differently based on intent type
    if (intent === 'product_recommendation') {
      return `The user is looking for product recommendations. 

CONVERSATIONAL APPROACH:
- Acknowledge their interest warmly and personally
- Ask follow-up questions to understand their preferences better
- Be engaging and conversational, not robotic
- Show you're thinking about their specific needs

SUGGESTED FOLLOW-UPS:
- "What's your budget range for this?"
- "What's the occasion or purpose?"
- "Do you have a preferred style or brand?"
- "Are you looking for something for yourself or as a gift?"
- "What's your preferred price range?"

Do NOT list specific products or categories in your response - the system will handle product recommendations separately.
Focus on engaging conversation and understanding their needs better.`;
    } else if (intent === 'product_search') {
      // For product search, provide the actual product information
      const productResults = results.filter(result => result.metadata?.productId);
      
      if (productResults.length === 0) {
        return `The user is looking for specific products, but I couldn't find exact matches. 

CONVERSATIONAL APPROACH:
- Acknowledge their search warmly
- Ask follow-up questions to help refine their search
- Be helpful and conversational

SUGGESTED FOLLOW-UPS:
- "What's your preferred price range?"
- "Do you have a specific style in mind?"
- "Are you looking for something for a special occasion?"
- "What's your budget for this?"

Suggest using our interactive product recommendation feature to help them find what they're looking for.`;
      }
      
      // Modified approach: Don't include detailed product listings in the context
      // Just provide general guidance on how to respond
      let context = `The user is looking for specific products. The system will display product cards for the matching products.
      
CONVERSATIONAL APPROACH:
- Acknowledge their search warmly and personally
- Ask follow-up questions to help them refine their search
- Be helpful and conversational
- Show you understand their needs

SUGGESTED FOLLOW-UPS:
- "Great choice! What's your preferred price range?"
- "Excellent! Do you have a specific style in mind?"
- "Perfect! Are you looking for something for a special occasion?"
- "That's a great selection! What's your budget?"
- "Wonderful! Do you prefer a specific brand or are you open to options?"

Please provide a brief, helpful response acknowledging their search and mentioning that you're showing them relevant products.
DO NOT list specific product details like prices, descriptions, etc. - these will be shown in product cards.
Keep your response conversational and helpful, focusing on addressing their query in general terms.

For example, if they asked about watches, you might say: "We have several watches in our collection. I'm showing you some options below."
Or if they asked about expensive perfumes, you might say: "Here are some of our premium perfumes from our luxury collection."

Remember to:
1. Be brief and conversational
2. Don't list specific product details
3. Acknowledge their query
4. Mention that you're showing them relevant products below
5. Ask a follow-up question to keep the conversation flowing`;
      
      return context;
    }
    
    let context = `Based on the following information, provide a helpful response:\n\n`;
    
    // Limit the number of results to include to prevent overwhelming the context
    const limitedResults = results.slice(0, 3);
    
    limitedResults.forEach((result, index) => {
      context += `${index + 1}. ${result.content}\n`;
      if (result.metadata?.source) {
        context += `   Source: ${result.metadata.source}\n`;
      }
    });
    
    context += `\nBe conversational and helpful. Ask follow-up questions to better understand their needs and keep the conversation flowing naturally.`;
    
    return context;
  }

  private async getConversationHistory(sessionId: string): Promise<{ role: string; content: string }[]> {
    try {
      // Get the last few messages from the conversation history
      const chatHistory = await vectorStorage.getChatHistory(sessionId);
      
      // Convert to the format expected by the AI service
      const messages = chatHistory
        .slice(-8) // Get the last 8 messages (4 exchanges) for context
        .map(msg => ({
        role: msg.isBot ? 'assistant' : 'user',
        content: msg.content
      }));
      
      return messages;
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

// New Enhanced RAG Service implementing Option 3
export class EnhancedRAGService {
  private ragService = new RAGService();
  
  // Helper method to determine if a query is product-related
  private isProductQuery(query: string): boolean {
    const lowerQuery = query.toLowerCase();
    
    // Check for product-related keywords
    const productKeywords = [
      'product', 'item', 'buy', 'purchase', 'shop', 'shopping',
      'price', 'cost', 'sale', 'discount', 'offer', 'deal',
      'recommend', 'suggestion', 'suggest', 'show me', 'looking for',
      'watch', 'perfume', 'fragrance', 'cologne', 'jewelry', 'oud', 'gift'
    ];
    
    // Check if any product keywords are in the query
    const containsProductKeyword = productKeywords.some(keyword => lowerQuery.includes(keyword));
    
    // Check for question patterns about products
    const isProductQuestion = 
      lowerQuery.includes('do you have') || 
      lowerQuery.includes('do you sell') ||
      lowerQuery.includes('can i buy') ||
      lowerQuery.includes('show me') ||
      lowerQuery.includes('what are your') ||
      lowerQuery.includes('what do you have');
    
    return containsProductKeyword || isProductQuestion;
  }

  private analyzeQueryIntent(query: string, conversationHistory: any[]): { intent: string; shouldStartProductFlow: boolean } {
    const lowerQuery = query.toLowerCase();
    
    // Check for greetings
    const greetingPatterns = [
      'hello', 'hi', 'hey', 'greetings', 'good morning', 'good afternoon', 'good evening'
    ];
    if (greetingPatterns.some(pattern => lowerQuery.startsWith(pattern))) {
      return { intent: 'greeting', shouldStartProductFlow: false };
    }
    
    // Check for order tracking
    const orderTrackingPatterns = [
      'order', 'track', 'shipping', 'delivery', 'package', 'status'
    ];
    if (orderTrackingPatterns.some(pattern => lowerQuery.includes(pattern))) {
      return { intent: 'order_tracking', shouldStartProductFlow: false };
    }
    
    // Check if this is a follow-up to a previous product-related question
    if (conversationHistory.length >= 2) {
      const lastAssistantMessage = [...conversationHistory]
        .reverse()
        .find(msg => msg.role === 'assistant');
        
      if (lastAssistantMessage) {
        const lowerAssistantMessage = lastAssistantMessage.content.toLowerCase();
        
        // Check if the last message was about products
        const productTerms = ['product', 'item', 'perfume', 'fragrance', 'cologne', 'watch', 'jewelry', 'oud', 'scent'];
        const lastMessageWasAboutProducts = productTerms.some(term => 
          lowerAssistantMessage.includes(term)
        );
        
        // Check if the last message was asking a question
        const wasAskingQuestion = lastAssistantMessage.content.includes('?') ||
          ['prefer', 'would you like', 'are you looking for', 'do you have', 'may i ask', 'what kind']
            .some(phrase => lowerAssistantMessage.includes(phrase));
        
        // Check if the current query is short and looks like a direct response
        const isShortResponse = query.split(' ').length <= 3;
        
        if (lastMessageWasAboutProducts && wasAskingQuestion && isShortResponse) {
          // If the last message was about product recommendations
          if (lowerAssistantMessage.includes('recommend') || 
              lowerAssistantMessage.includes('suggest') || 
              lowerAssistantMessage.includes('might like') || 
              lowerAssistantMessage.includes('might enjoy')) {
            return { intent: 'product_recommendation', shouldStartProductFlow: true };
          }
          
          // Default to product search for other product-related follow-ups
          return { intent: 'product_search', shouldStartProductFlow: true };
        }
      }
    }
    
    // Check for product recommendations
    const recommendationPatterns = [
      'recommend', 'suggestion', 'suggest', 'best', 'popular', 'top', 'trending',
      'what do you have', 'show me', 'what are your', 'do you have'
    ];
    if (recommendationPatterns.some(pattern => lowerQuery.includes(pattern))) {
      return { intent: 'product_recommendation', shouldStartProductFlow: true };
    }
    
    // Check for product search
    const searchPatterns = [
      'find', 'search', 'looking for', 'where can i find', 'do you sell'
    ];
    if (searchPatterns.some(pattern => lowerQuery.includes(pattern)) || this.isProductQuery(lowerQuery)) {
      return { intent: 'product_search', shouldStartProductFlow: true };
    }
    
    // Check for support questions
    const supportPatterns = [
      'help', 'support', 'assistance', 'problem', 'issue', 'question', 'how do i', 'how to'
    ];
    if (supportPatterns.some(pattern => lowerQuery.includes(pattern))) {
      return { intent: 'support', shouldStartProductFlow: false };
    }
    
    // Check if this is a follow-up to a product-related conversation
    const isProductFollowUp = this.isFollowUpToProductSearch(query, conversationHistory);
    if (isProductFollowUp) {
      return { intent: 'product_search', shouldStartProductFlow: true };
    }
    
    // Default to general question
    return { intent: 'general_question', shouldStartProductFlow: false };
  }
  
  // Method to query the original RAG system
  private async queryRagSystem(query: string, sessionId: string): Promise<any> {
    try {
      // Get conversation history
      const conversationHistory = await this.getConversationHistory(sessionId);
      
      // Check if this is a follow-up query to a previous product search
      const isFollowUpToProductSearch = this.isFollowUpToProductSearch(query, conversationHistory);
      
      // Analyze query intent
      const queryAnalysis = this.analyzeQueryIntent(query, conversationHistory);
      
      // If it's a follow-up to a product search, adjust the intent
      if (isFollowUpToProductSearch) {
        if (query.toLowerCase().includes('more') || 
            query.toLowerCase().includes('other') || 
            query.toLowerCase().includes('similar') ||
            query.toLowerCase().includes('else') ||
            query.toLowerCase().includes('additional')) {
          queryAnalysis.intent = 'product_search';
          queryAnalysis.shouldStartProductFlow = true;
          console.log('Detected follow-up product search query, adjusting intent');
        }
      }
      
      // Perform the RAG query
      const ragResponse = await this.ragService.query(query, sessionId);
      
      return {
        answer: ragResponse.answer,
        sources: ragResponse.sources,
        confidence: ragResponse.confidence,
        intent: queryAnalysis.intent,
        shouldStartProductFlow: queryAnalysis.shouldStartProductFlow
      };
    } catch (error) {
      console.error('Error in queryRagSystem:', error);
      return {
        answer: "I apologize, but I'm having trouble processing your request right now. Please try again later.",
        sources: [],
        confidence: 0,
        intent: 'error',
        shouldStartProductFlow: false
      };
    }
  }
  
  private isFollowUpToProductSearch(query: string, conversationHistory: any[]): boolean {
    // If the conversation is too short, it's not a follow-up
    if (conversationHistory.length < 2) return false;
    
    // Check the last assistant message
    const lastAssistantMessage = [...conversationHistory]
      .reverse()
      .find(msg => msg.role === 'assistant');
      
    if (!lastAssistantMessage) return false;
    
    // Check if the last assistant message was about products
    const productTerms = ['product', 'item', 'perfume', 'fragrance', 'cologne', 'watch', 'jewelry', 'oud'];
    const lastMessageWasAboutProducts = productTerms.some(term => 
      lastAssistantMessage.content.toLowerCase().includes(term)
    );
    
    // Check if the current query is short and generic
    const isShortGenericQuery = query.split(' ').length <= 4 && 
      (query.toLowerCase().includes('more') || 
       query.toLowerCase().includes('show') ||
       query.toLowerCase().includes('other') ||
       query.toLowerCase().includes('similar') ||
       query.toLowerCase().includes('else'));
    
    return lastMessageWasAboutProducts && isShortGenericQuery;
  }
  
  // Method to determine the intent of a query
  private determineIntent(query: string, ragResponse: any): string {
    const lowerQuery = query.toLowerCase();
    
    // Check for greetings
    const greetingPatterns = [
      'hello', 'hi', 'hey', 'greetings', 'good morning', 'good afternoon', 'good evening'
    ];
    if (greetingPatterns.some(pattern => lowerQuery.startsWith(pattern))) {
      return 'greeting';
    }
    
    // Check for order tracking
    const orderTrackingPatterns = [
      'order', 'track', 'shipping', 'delivery', 'package', 'status'
    ];
    if (orderTrackingPatterns.some(pattern => lowerQuery.includes(pattern))) {
      return 'order_tracking';
    }
    
    // Check for product recommendations
    const recommendationPatterns = [
      'recommend', 'suggestion', 'suggest', 'best', 'popular', 'top', 'trending',
      'what do you have', 'show me', 'what are your', 'do you have'
    ];
    if (recommendationPatterns.some(pattern => lowerQuery.includes(pattern))) {
      return 'product_recommendation';
    }
    
    // Check for product search
    const searchPatterns = [
      'find', 'search', 'looking for', 'where can i find', 'do you sell'
    ];
    if (searchPatterns.some(pattern => lowerQuery.includes(pattern)) || this.isProductQuery(lowerQuery)) {
      return 'product_search';
    }
    
    // Check for support questions
    const supportPatterns = [
      'help', 'support', 'assistance', 'problem', 'issue', 'question', 'how do i', 'how to'
    ];
    if (supportPatterns.some(pattern => lowerQuery.includes(pattern))) {
      return 'support';
    }
    
    // Default to general question
    return 'general_question';
  }
  
  // Method to find relevant products based on a query
  private async findRelevantProducts(query: string, limit: number = 5): Promise<any[]> {
    try {
      // Read the products from the JSON file
      const productsFilePath = path.join(process.cwd(), 'data-storage', 'products.json');
      console.log(`Reading products from: ${productsFilePath}`);
      
      const productsData = fs.readFileSync(productsFilePath, 'utf8');
      console.log(`Successfully read products data (${productsData.length} bytes)`);
      
      const products = JSON.parse(productsData);
      console.log(`Successfully parsed products data (${products.length} products)`);
      
      // Extract key terms from the query
      const searchTerms = this.extractSearchTerms(query);
      console.log(`Extracted search terms: ${searchTerms.join(', ')}`);
      
      // Extract price range from query
      const priceRange = this.extractPriceRange(query);
      console.log(`Extracted price range: ${priceRange ? `${priceRange.min}-${priceRange.max} AED` : 'none'}`);
      
      // Score each product based on relevance to the query
      const scoredProducts = products.map((product: any) => {
        const title = (product.title || '').toLowerCase();
        const description = (product.description || '').toLowerCase();
        const category = (product.category || '').toLowerCase();
        const brand = (product.brand || '').toLowerCase();
        
        // Calculate a relevance score
        let score = 0;
        
        // Check for exact matches in title (highest weight)
        searchTerms.forEach((term: string) => {
          if (title.includes(term)) {
            score += 10; // High weight for title matches
          }
          
          if (description.includes(term)) {
            score += 5; // Medium weight for description matches
          }
          
          if (category.includes(term)) {
            score += 8; // High-medium weight for category matches
          }
          
          if (brand.includes(term)) {
            score += 8; // High-medium weight for brand matches
          }
        });
        
        // Check for semantic similarity using word embeddings
        // This is a simplified version - in a real implementation, you'd use
        // actual word embeddings or a similarity algorithm
        const queryLower = query.toLowerCase();
        
        // Bonus points for products that match multiple terms
        const matchedTermCount = searchTerms.filter((term: string) => 
          title.includes(term) || description.includes(term) || 
          category.includes(term) || brand.includes(term)
        ).length;
        
        if (matchedTermCount > 1) {
          score += matchedTermCount * 3; // Bonus for multiple term matches
        }
        
        // Check for product type matches (e.g., "watch", "perfume")
        const productTypes = this.extractProductTypes(title);
        if (productTypes.some(type => queryLower.includes(type))) {
          score += 15; // Very high weight for product type matches
        }
        
        return { product, score };
      });
      
      // Filter by price range if specified
      let filteredProducts = scoredProducts;
      if (priceRange) {
        console.log(`Applying price filter: ${priceRange.min}-${priceRange.max} AED`);
        const beforeCount = scoredProducts.length;
        filteredProducts = scoredProducts.filter((item: { product: any; score: number }) => {
          const price = parseFloat(item.product.price) || 0;
          const isInRange = price >= priceRange.min && price <= priceRange.max;
          if (!isInRange) {
            console.log(`Filtered out: ${item.product.title} (${price} AED) - outside range ${priceRange.min}-${priceRange.max}`);
          }
          return isInRange;
        });
        console.log(`Price filtering: ${beforeCount} products -> ${filteredProducts.length} products within range ${priceRange.min}-${priceRange.max} AED`);
      } else {
        console.log(`No price range specified, skipping price filtering`);
      }
      
      // Sort by score and take the top results
      const topProducts = filteredProducts
        .filter((item: { product: any; score: number }) => item.score > 0) // Only include products with some relevance
        .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
        .slice(0, limit)
        .map((item: { product: any }) => item.product);
      
      console.log(`Found ${topProducts.length} relevant products based on scoring`);
      
      // If no products found with scoring, fall back to a subset of all products
      const results = topProducts.length > 0 ? topProducts : products.slice(0, limit);
      
      console.log(`Selected ${results.length} products to return`);
      
      // Process the results to ensure all required fields
      const processedResults = results.map((product: any) => {
        // Ensure product URL is absolute
        let productUrl = product.productUrl || '';
        if (productUrl && !productUrl.startsWith('http')) {
          productUrl = `https://www.karjistore.com${productUrl.startsWith('/') ? productUrl : '/' + productUrl}`;
        }
        
        // Ensure image URL is absolute
        let imageUrl = product.imageUrl || '';
        if (imageUrl && !imageUrl.startsWith('http')) {
          imageUrl = `https://www.karjistore.com${imageUrl.startsWith('/') ? imageUrl : '/' + imageUrl}`;
        }
        
        // Ensure price is a valid number
        let price = product.price;
        if (typeof price === 'string') {
          price = parseFloat(price);
        }
        if (!price || isNaN(price)) {
          price = 0;
        }
        
        return {
          title: product.title || 'Unknown Product',
          description: product.description || 'No description available',
          price: price,
          imageUrl: imageUrl,
          productUrl: productUrl
        };
      });
      
      return processedResults;
    } catch (error) {
      console.error('Error finding relevant products:', error);
      return [];
    }
  }

  // Helper method to extract search terms from a query
  private extractSearchTerms(query: string): string[] {
    const lowerQuery = query.toLowerCase();
    
    // Remove common stop words
    const stopWords = ['i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 
      'you', 'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 
      'she', 'her', 'hers', 'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 
      'theirs', 'themselves', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 
      'those', 'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 
      'had', 'having', 'do', 'does', 'did', 'doing', 'a', 'an', 'the', 'and', 'but', 
      'if', 'or', 'because', 'as', 'until', 'while', 'of', 'at', 'by', 'for', 'with', 
      'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after', 
      'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 
      'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 
      'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 
      'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 
      'very', 's', 't', 'can', 'will', 'just', 'don', 'should', 'now', 'show', 'me', 
      'recommend', 'suggest', 'need', 'want', 'looking', 'for', 'have', 'get', 'find'];
    
    // Extract meaningful terms
    const terms = lowerQuery
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .split(' ')
      .filter(word => word.length > 1 && !stopWords.includes(word)); // Filter out stop words and short words
    
    // Handle special cases - extract product types and specific product terms
    const productTypes = ['watch', 'perfume', 'fragrance', 'cologne', 'jewelry', 'oud', 'gift'];
    productTypes.forEach(type => {
      if (lowerQuery.includes(type) && !terms.includes(type)) {
        terms.push(type);
      }
    });
    
    // Handle special phrases
    if (lowerQuery.includes('men') || lowerQuery.includes("men's")) {
      terms.push('men');
    }
    if (lowerQuery.includes('women') || lowerQuery.includes("women's")) {
      terms.push('women');
    }
    
    // If no terms were found after filtering, take the original query words that are at least 3 chars
    if (terms.length === 0) {
      return lowerQuery.split(' ').filter(word => word.length > 2);
    }
    
    return terms;
  }
  
  // Helper method to extract product types from a title
  private extractProductTypes(title: string): string[] {
    const lowerTitle = title.toLowerCase();
    const commonProductTypes = [
      'watch', 'perfume', 'fragrance', 'cologne', 'jewelry', 'accessory',
      'necklace', 'bracelet', 'ring', 'earring', 'pendant', 'oud',
      'eau de parfum', 'eau de toilette', 'edp', 'edt', 'spray'
    ];
    
    return commonProductTypes.filter(type => lowerTitle.includes(type));
  }

  // Helper method to extract price range from query
  private extractPriceRange(query: string): { min: number; max: number } | null {
    const lowerQuery = query.toLowerCase();
    console.log(`Extracting price range from query: "${query}"`);
    
    // Pattern to match price ranges like "300 - 400 dihrams" or "300-400 AED"
    const priceRangePatterns = [
      /(\d+)\s*-\s*(\d+)\s*(dihrams?|aed|dirhams?)/i,
      /(\d+)\s*to\s*(\d+)\s*(dihrams?|aed|dirhams?)/i,
      /range\s*(\d+)\s*-\s*(\d+)\s*(dihrams?|aed|dirhams?)/i,
      /price\s*range\s*(\d+)\s*-\s*(\d+)\s*(dihrams?|aed|dirhams?)/i,
      // More flexible patterns
      /(\d+)\s*-\s*(\d+)/i,  // Just numbers with dash
      /(\d+)\s*to\s*(\d+)/i, // Just numbers with "to"
      /range\s*(\d+)\s*-\s*(\d+)/i, // Range with numbers
      /price\s*range\s*(\d+)\s*-\s*(\d+)/i // Price range with numbers
    ];
    
    for (let i = 0; i < priceRangePatterns.length; i++) {
      const pattern = priceRangePatterns[i];
      const match = lowerQuery.match(pattern);
      if (match) {
        console.log(`Pattern ${i + 1} matched: ${match[0]}`);
        const min = parseInt(match[1]);
        const max = parseInt(match[2]);
        if (min && max && min <= max) {
          console.log(`Extracted price range: ${min}-${max}`);
          return { min, max };
        }
      }
    }
    
    console.log(`No price range pattern matched for query: "${query}"`);
    return null;
  }
  
  async query(userQuery: string, sessionId: string): Promise<{
    answer: string;
    sources?: Array<{ title: string; url?: string }>;
    confidence?: number;
    intent?: string;
    shouldStartProductFlow?: boolean;
    products?: any[];
    orderData?: any;
  }> {
    try {
      // Check if the query is about products
      const isProductQuery = this.isProductQuery(userQuery);
      
      // If it's a product query, we'll want to include product recommendations
      let products: any[] = [];
      if (isProductQuery) {
        // Use the findRelevantProducts method to get product recommendations
        products = await this.findRelevantProducts(userQuery);
      }
      
      // Generate a response using the RAG system
      const ragResponse = await this.queryRagSystem(userQuery, sessionId);
      
      // Determine intent and whether to start product flow
      const intent = this.determineIntent(userQuery, ragResponse);
      
      // For product recommendation intent, always try to get products if none were found initially
      if (intent === 'product_recommendation' && products.length === 0) {
        products = await this.findRelevantProducts(userQuery, 5);
        console.log(`Found ${products.length} products for recommendation intent after second attempt`);
      }
      
      const shouldStartProductFlow = (intent === 'product_recommendation' || intent === 'product_search') && products.length === 0;
      
      // Save the conversation messages
      await this.saveConversationMessages(userQuery, ragResponse.answer, sessionId);
      
      // If we have products and the intent is product-related, include them in the response
      if (products.length > 0 && (intent === 'product_recommendation' || intent === 'product_search')) {
        return {
          answer: ragResponse.answer,
          sources: ragResponse.sources,
          confidence: ragResponse.confidence,
          intent,
          shouldStartProductFlow: false, // We already have products, no need to start the flow
          products
        };
      }
      
      // Return the RAG response with intent and product flow flag
      return {
        answer: ragResponse.answer,
        sources: ragResponse.sources,
        confidence: ragResponse.confidence,
        intent,
        shouldStartProductFlow
      };
    } catch (error) {
      console.error('Error in enhanced RAG query:', error);
      const errorMessage = "I'm sorry, I encountered an error while processing your request. Please try again later.";
      
      // Save the error conversation
      try {
        await this.saveConversationMessages(userQuery, errorMessage, sessionId);
      } catch (saveError) {
        console.error('Error saving error conversation:', saveError);
      }
      
      return {
        answer: errorMessage,
        confidence: 0,
        intent: 'error',
        shouldStartProductFlow: false
      };
    }
  }
  
  private rankAndCombineResults(
    knowledgeResults: any[], 
    productResults: any[]
  ): SearchResult[] {
    const allResults: SearchResult[] = [
      ...knowledgeResults.map(r => ({
        id: r.metadata.parentId || 'unknown',
        content: r.content,
        score: r.score,
        metadata: r.metadata
      })),
      ...productResults.map(r => ({
        id: r.metadata.productId || 'unknown',
        content: r.content,
        score: r.score,
        metadata: r.metadata
      }))
    ];
    
    // Sort by relevance score and return top results
    return allResults
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }
  
  private buildComprehensiveContext(results: SearchResult[], query: string, isOrderTrackingFlow: boolean): string {
    if (results.length === 0 && !isOrderTrackingFlow) {
      return 'No specific information found. Provide general assistance based on your knowledge.';
    }
    
    let context = `Based on the user's query: "${query}", here is the most relevant information:\n\n`;
    
    // Check if query is likely about order tracking
    if (isOrderTrackingFlow) {
      context += `ORDER TRACKING INFORMATION:
The user appears to be asking about order tracking. To track an order, we need:
1. The customer's email address
2. The order ID/number
If the user hasn't provided these details, ask for them politely.
Once you have both pieces of information, inform the user that you'll check their order status.
`;
      return context;
    }
    
    // Categorize results
    const productResults = results.filter(r => r.metadata?.productId);
    const knowledgeResults = results.filter(r => !r.metadata?.productId);
    
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
    
    context += `Use this information to provide a helpful, accurate response to the user's query. If the information doesn't fully address their query, use your general knowledge but prioritize the provided information.`;
    
    return context;
  }
  
  private async generateUnifiedResponse(
    query: string,
    searchResults: SearchResult[],
    context: string,
    conversationHistory: { role: string; content: string }[]
  ): Promise<string> {
    // Include more conversation history for better context awareness
    const recentMessages = conversationHistory.slice(-10); // Last 10 messages for better context
    
    const messages = [
      ...recentMessages,
      { role: 'user', content: query }
    ];
    
    // Generate response using AI service
    return await aiService.generateResponse(messages, context);
  }
  
  private getUnifiedSystemPrompt(): string {
    return `You are a helpful customer service assistant for KarjiStore. Be friendly, professional, and CONVERSATIONAL.

Your role is to:
1. Assist customers with their inquiries in a friendly, professional manner
2. Help with order tracking, product recommendations, and general questions
3. Provide accurate information based on the available data
4. Engage in natural dialogue and ask follow-up questions
5. Make customers feel like they're talking to a real human

CONVERSATIONAL GUIDELINES:
- Be warm, engaging, and conversational
- Ask follow-up questions to better understand their needs
- Show you're thinking about their specific situation
- Don't be robotic - be natural and helpful
- Keep the conversation flowing naturally

EXAMPLES OF GOOD FOLLOW-UPS:
- "What's your budget range for this?"
- "What's the occasion or purpose?"
- "Do you have a preferred style or brand?"
- "Are you looking for something for yourself or as a gift?"
- "What's your preferred price range?"
- "Do you have a specific style in mind?"
- "Are you looking for something for a special occasion?"

If you don't know something, politely say so and offer to help them find the information they need.

Always maintain a positive, solution-oriented tone and keep the conversation engaging.`;
  }
  
  private isOrderTrackingFlow(query: string, conversationHistory: { role: string; content: string }[]): boolean {
    const lowerQuery = query.toLowerCase();
    
    // Check for direct order tracking keywords in the query
    const orderTrackingKeywords = ['order', 'track', 'shipping', 'delivery', 'package', 'status', 'where is my order'];
    const containsOrderKeywords = orderTrackingKeywords.some(keyword => lowerQuery.includes(keyword));
    
    // If the query is very short (1-2 words), make sure it's not a simple response to a previous question
    if (query.split(' ').length <= 2) {
      // Check if the previous message was asking for a preference
      const lastAssistantMessage = [...conversationHistory]
        .reverse()
        .find(msg => msg.role === 'assistant');
        
      if (lastAssistantMessage) {
        const lowerAssistantMessage = lastAssistantMessage.content.toLowerCase();
        // If the last message was asking about preferences, this short query is likely a response to that
        if (lowerAssistantMessage.includes('prefer') || 
            lowerAssistantMessage.includes('would you like') ||
            lowerAssistantMessage.includes('are you looking for') ||
            lowerAssistantMessage.includes('do you have a') ||
            lowerAssistantMessage.includes('may i ask')) {
          return false;
        }
      }
    }
    
    // Check if this is a continuation of an order tracking flow
    if (conversationHistory.length >= 2) {
      const recentMessages = conversationHistory.slice(-4);
      
      // Check if any recent assistant message was about order tracking
      const recentOrderTracking = recentMessages.some(msg => 
        msg.role === 'assistant' && 
        msg.content.toLowerCase().includes('order') &&
        (msg.content.toLowerCase().includes('track') || 
         msg.content.toLowerCase().includes('email') ||
         msg.content.toLowerCase().includes('number'))
      );
      
      if (recentOrderTracking) {
        // Check if this looks like an email or order number
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const orderIdRegex = /^[A-Za-z0-9-]{3,20}$/;
        
        if (emailRegex.test(query) || (orderIdRegex.test(query) && !lowerQuery.includes(' '))) {
          return true;
        }
      }
    }
    
    return containsOrderKeywords;
  }
  
  private extractOrderTrackingInfo(message: string): { email?: string; orderId?: string } {
    // Simple regex for email extraction
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
    const emailMatch = message.match(emailRegex);
    
    // Extract anything that looks like an order ID (alphanumeric with possible hyphens)
    const orderIdRegex = /\b([A-Za-z0-9]{2,}-?[A-Za-z0-9]{2,})\b/;
    const orderIdMatch = message.match(orderIdRegex);
    
    return {
      email: emailMatch ? emailMatch[0] : undefined,
      orderId: orderIdMatch ? orderIdMatch[0] : undefined
    };
  }
  
  private async trackOrder(email: string, orderId: string): Promise<any> {
    // In a real implementation, this would call your order tracking API
    // For this example, we'll simulate a call to the mock API
    try {
      const response = await fetch('/api/track-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, orderId })
      });
      
      if (!response.ok) {
        throw new Error('Order not found');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error tracking order:', error);
      throw error;
    }
  }
  
  private async generateResponseWithOrderInfo(
    query: string,
    orderData: any,
    sessionId: string
  ): Promise<string> {
    const conversationHistory = await this.getConversationHistory(sessionId);
    const context = this.buildContextWithOrderInfo(orderData);
    
    const systemPrompt = `You are a helpful customer service assistant for KarjiStore. 
The user has requested order tracking information, and we've found their order. 
Provide the order details in a friendly, helpful way.`;
    
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-6),
      { role: 'user', content: query }
    ];
    
    return await aiService.generateResponse(messages, context);
  }
  
  private buildContextWithOrderInfo(orderData: any): string {
    return `ORDER INFORMATION:
Order Number: ${orderData.order.orderNumber}
Customer: ${orderData.order.customer.name}
Email: ${orderData.order.customer.email}
Status: ${orderData.order.status}
Order Date: ${new Date(orderData.order.orderDate).toLocaleDateString()}
Latest Update: ${orderData.latestUpdate ? orderData.latestUpdate.status : 'No updates available'}

Please provide this order information to the user in a friendly, helpful way.
`;
  }
  
  private extractProductsIfPresent(searchResults: SearchResult[]): Array<{
    title: string;
    description: string;
    price: number;
    imageUrl: string | null;
    productUrl: string;
  }> | undefined {
    const productResults = searchResults.filter(result => result.metadata?.productId);
    
    if (productResults.length === 0) {
      return undefined;
    }
    
    // Always return products in a structured format suitable for card display
    return productResults.map(result => ({
      title: result.metadata?.title || 'Unknown Product',
      description: result.content,
      price: result.metadata?.price ? parseFloat(String(result.metadata.price)) : 0,
      imageUrl: result.metadata?.imageUrl || null,
      productUrl: result.metadata?.productUrl || '#'
    }));
  }
  
  private calculateConfidence(searchResults: SearchResult[]): number {
    if (!searchResults || searchResults.length === 0) {
      return 0.5;
    }
    
    // Calculate average score of top 3 results
    const topScores = searchResults.slice(0, 3).map(result => result.score);
    const avgScore = topScores.reduce((sum, score) => sum + score, 0) / topScores.length;
    
    // Scale the score to a confidence value between 0.5 and 1.0
    return 0.5 + (avgScore * 0.5);
  }
  
  private async getConversationHistory(sessionId: string): Promise<any[]> {
    try {
      // Get the last few messages from the conversation history
      const chatHistory = await vectorStorage.getChatHistory(sessionId);
      
      // Convert to the format expected by the AI service
      const messages = chatHistory
        .slice(-8) // Get the last 8 messages (4 exchanges) for context
        .map(msg => ({
          role: msg.isBot ? 'assistant' : 'user',
          content: msg.content
        }));
      
      return messages;
    } catch (error) {
      console.error('Error getting conversation history in EnhancedRAGService:', error);
      return [];
    }
  }
  
  private async saveConversationMessages(userMessage: string, botResponse: string, sessionId: string): Promise<void> {
    try {
      const sessionFilePath = path.join(process.cwd(), 'data-storage', `chat-session-${sessionId}.json`);
      let sessionData: any = [];
      
      // If the session file exists, load it
      if (fs.existsSync(sessionFilePath)) {
        sessionData = JSON.parse(fs.readFileSync(sessionFilePath, 'utf8'));
      }
      
      // Add the new messages
      sessionData.push({ content: userMessage, isBot: false, timestamp: new Date().toISOString() });
      sessionData.push({ content: botResponse, isBot: true, timestamp: new Date().toISOString() });
      
      // Save the updated session data
      fs.writeFileSync(sessionFilePath, JSON.stringify(sessionData, null, 2));
    } catch (error) {
      console.error('Error saving conversation messages:', error);
    }
  }
  
  // Knowledge base and product management methods can be added here
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
      
      console.log(`Added knowledge document: ${title}`);
      return knowledgeItem.id.toString();
    } catch (error) {
      console.error('Error adding knowledge document:', error);
      throw error;
    }
  }
  
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
      await vectorStorage.addProduct(productData);
      console.log(`Added product: ${productData.title}`);
    } catch (error) {
      console.error('Error adding product:', error);
      throw error;
    }
  }

  // Helper method to determine if a query is product-related
  private isProductRelatedQuery(query: string): boolean {
    const lowerQuery = query.toLowerCase();
    const productKeywords = [
      'product', 'buy', 'purchase', 'price', 'cost', 'item', 'catalog', 
      'shop', 'perfume', 'fragrance', 'scent', 'cologne', 'accessory',
      'watch', 'jewelry', 'recommend', 'suggestion'
    ];
    
    return productKeywords.some(keyword => lowerQuery.includes(keyword));
  }
}

// Create an instance of the RAGService class
export const ragService = new RAGService();

// Create an instance of the EnhancedRAGService class
export const enhancedRagService = new EnhancedRAGService();