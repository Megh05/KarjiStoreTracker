import { vectorStorage } from './vector-storage';
import { aiService } from './ai-service';

export interface ConversationalContext {
  sessionId: string;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    intent?: string;
    entities?: Record<string, any>;
  }>;
  userPreferences: Record<string, any>;
  conversationState: {
    currentTopic: string;
    pendingQuestions: string[];
    collectedInfo: Record<string, any>;
    lastProductMentioned?: any;
    lastCategoryDiscussed?: string;
  };
  memory: {
    mentionedProducts: string[];
    discussedCategories: string[];
    userPreferences: Record<string, any>;
    conversationFlow: 'greeting' | 'product_search' | 'order_tracking' | 'general_inquiry' | 'preference_collection';
  };
}

export interface ConversationalRAGResponse {
  answer: string;
  context: {
    conversationState: string;
    relevantHistory: string[];
    userPreferences: Record<string, any>;
    followUpQuestions: string[];
  };
  shouldAskFollowUp: boolean;
  followUpQuestions: string[];
  confidence: number;
  debug?: {
    contextUsed: string[];
    conversationFlow: string;
    reasoning: string;
  };
}

/**
 * ConversationalRAGService - Handles conversation context and follow-up questions
 * 
 * Key features:
 * 1. Maintains conversation state and history
 * 2. Handles follow-up questions intelligently
 * 3. Tracks user preferences and context
 * 4. Provides contextual responses
 * 5. Manages conversation flow
 */
export class ConversationalRAGService {
  private conversationContexts: Map<string, ConversationalContext> = new Map();

  /**
   * Process a user message with conversation context
   */
  async processMessage(
    userMessage: string,
    sessionId: string
  ): Promise<ConversationalRAGResponse> {
    try {
      console.log(`ConversationalRAG processing message: "${userMessage}" for session: ${sessionId}`);
      
      // Get or create conversation context
      const context = this.getOrCreateContext(sessionId);
      
      // Analyze the message for intent and entities
      const messageAnalysis = await this.analyzeMessage(userMessage, context);
      
      // Update conversation context
      this.updateConversationContext(context, userMessage, messageAnalysis);
      
      // Get relevant conversation history
      const relevantHistory = this.getRelevantHistory(context, userMessage);
      
      // Generate contextual response
      const response = await this.generateContextualResponse(
        userMessage,
        context,
        relevantHistory,
        messageAnalysis
      );
      
      // Update context with response
      this.updateContextWithResponse(context, response);
      
      // Save conversation to storage
      await this.saveConversationToStorage(sessionId, userMessage, response.answer);
      
      return response;
    } catch (error) {
      console.error('Error in ConversationalRAG:', error);
      return {
        answer: "I'm sorry, I'm having trouble processing your message. Could you please rephrase?",
        context: {
          conversationState: 'error',
          relevantHistory: [],
          userPreferences: {},
          followUpQuestions: []
        },
        shouldAskFollowUp: false,
        followUpQuestions: [],
        confidence: 0.3,
        debug: {
          contextUsed: [],
          conversationFlow: 'error',
          reasoning: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Get or create conversation context for a session
   */
  private getOrCreateContext(sessionId: string): ConversationalContext {
    if (!this.conversationContexts.has(sessionId)) {
      const newContext: ConversationalContext = {
        sessionId,
        conversationHistory: [],
        userPreferences: {},
        conversationState: {
          currentTopic: 'greeting',
          pendingQuestions: [],
          collectedInfo: {},
          lastProductMentioned: null,
          lastCategoryDiscussed: null
        },
        memory: {
          mentionedProducts: [],
          discussedCategories: [],
          userPreferences: {},
          conversationFlow: 'greeting'
        }
      };
      this.conversationContexts.set(sessionId, newContext);
    }
    return this.conversationContexts.get(sessionId)!;
  }

  /**
   * Analyze user message for intent and entities
   */
  private async analyzeMessage(
    message: string,
    context: ConversationalContext
  ): Promise<{
    intent: string;
    entities: Record<string, any>;
    isFollowUp: boolean;
    requiresContext: boolean;
    confidence: number;
  }> {
    try {
      const systemPrompt = `Analyze this user message in the context of a conversation about KarjiStore (perfumes, watches, luxury gifts).

Current conversation state:
- Topic: ${context.conversationState.currentTopic}
- Last product mentioned: ${context.conversationState.lastProductMentioned?.title || 'None'}
- Last category discussed: ${context.conversationState.lastCategoryDiscussed || 'None'}
- User preferences: ${JSON.stringify(context.userPreferences)}

Analyze the message and return a JSON response with:
{
  "intent": "greeting|product_search|order_tracking|preference_collection|general_inquiry|follow_up",
  "entities": {
    "products": ["product names mentioned"],
    "categories": ["categories mentioned"],
    "preferences": {"budget": "low|mid|high", "style": "casual|formal|luxury", "gender": "men|women|unisex"},
    "order_info": {"email": "email if mentioned", "order_id": "order id if mentioned"}
  },
  "isFollowUp": true/false,
  "requiresContext": true/false,
  "confidence": 0.0-1.0
}

Message: "${message}"`;

      const response = await aiService.generateResponse([
        { role: 'user', content: systemPrompt }
      ]);

      // Parse JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback analysis
      return {
        intent: this.fallbackIntentAnalysis(message),
        entities: {},
        isFollowUp: context.conversationHistory.length > 0,
        requiresContext: true,
        confidence: 0.7
      };
    } catch (error) {
      console.error('Error analyzing message:', error);
      return {
        intent: this.fallbackIntentAnalysis(message),
        entities: {},
        isFollowUp: context.conversationHistory.length > 0,
        requiresContext: true,
        confidence: 0.5
      };
    }
  }

  /**
   * Fallback intent analysis using keyword matching
   */
  private fallbackIntentAnalysis(message: string): string {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) return 'greeting';
    if (lowerMessage.includes('order') || lowerMessage.includes('track')) return 'order_tracking';
    if (lowerMessage.includes('perfume') || lowerMessage.includes('watch') || lowerMessage.includes('gift')) return 'product_search';
    if (lowerMessage.includes('prefer') || lowerMessage.includes('like') || lowerMessage.includes('want')) return 'preference_collection';
    
    return 'general_inquiry';
  }

  /**
   * Update conversation context with new message
   */
  private updateConversationContext(
    context: ConversationalContext,
    message: string,
    analysis: any
  ): void {
    // Add message to history
    context.conversationHistory.push({
      role: 'user',
      content: message,
      timestamp: new Date(),
      intent: analysis.intent,
      entities: analysis.entities
    });

    // Extract preferences from message content
    const messageLower = message.toLowerCase();
    
    // Track style preferences
    if (['classic', 'modern', 'sporty', 'elegant'].some(style => messageLower.includes(style))) {
      const style = messageLower.includes('classic') ? 'classic' : 
                   messageLower.includes('modern') ? 'modern' : 
                   messageLower.includes('sporty') ? 'sporty' : 'elegant';
      context.userPreferences.style = style;
      context.memory.userPreferences.style = style;
    }
    
    // Track budget preferences
    if (/\d+/.test(messageLower) || messageLower.includes('budget')) {
      const budgetMatch = messageLower.match(/(\d+)-(\d+)/);
      if (budgetMatch) {
        const budget = `${budgetMatch[1]}-${budgetMatch[2]}`;
        context.userPreferences.budget = budget;
        context.memory.userPreferences.budget = budget;
      }
    }
    
    // Track gender preferences
    if (messageLower.includes('women') || messageLower.includes('ladies')) {
      context.userPreferences.gender = 'women';
      context.memory.userPreferences.gender = 'women';
    } else if (messageLower.includes('men') || messageLower.includes('gents')) {
      context.userPreferences.gender = 'men';
      context.memory.userPreferences.gender = 'men';
    }
    
    // Track category preferences
    if (messageLower.includes('watch')) {
      context.userPreferences.category = 'watch';
      context.memory.userPreferences.category = 'watch';
    } else if (messageLower.includes('perfume') || messageLower.includes('fragrance')) {
      context.userPreferences.category = 'perfume';
      context.memory.userPreferences.category = 'perfume';
    }

    // Update conversation state based on intent
    switch (analysis.intent) {
      case 'product_search':
        context.conversationState.currentTopic = 'product_search';
        if (analysis.entities.products?.length > 0) {
          context.conversationState.lastProductMentioned = analysis.entities.products[0];
        }
        if (analysis.entities.categories?.length > 0) {
          context.conversationState.lastCategoryDiscussed = analysis.entities.categories[0];
        }
        break;
      case 'order_tracking':
        context.conversationState.currentTopic = 'order_tracking';
        if (analysis.entities.order_info) {
          Object.assign(context.conversationState.collectedInfo, analysis.entities.order_info);
        }
        break;
      case 'preference_collection':
        context.conversationState.currentTopic = 'preference_collection';
        if (analysis.entities.preferences) {
          Object.assign(context.userPreferences, analysis.entities.preferences);
        }
        break;
    }

    // Update memory
    if (analysis.entities.products) {
      context.memory.mentionedProducts.push(...analysis.entities.products);
    }
    if (analysis.entities.categories) {
      context.memory.discussedCategories.push(...analysis.entities.categories);
    }
    if (analysis.entities.preferences) {
      Object.assign(context.memory.userPreferences, analysis.entities.preferences);
    }
  }

  /**
   * Get relevant conversation history for context
   */
  private getRelevantHistory(
    context: ConversationalContext,
    currentMessage: string
  ): string[] {
    const relevantHistory: string[] = [];
    
    // Get last 3 messages for context
    const recentMessages = context.conversationHistory.slice(-3);
    
    for (const message of recentMessages) {
      if (message.role === 'user') {
        relevantHistory.push(`User: ${message.content}`);
      } else {
        relevantHistory.push(`Assistant: ${message.content}`);
      }
    }
    
    return relevantHistory;
  }

  /**
   * Generate contextual response
   */
  private async generateContextualResponse(
    userMessage: string,
    context: ConversationalContext,
    relevantHistory: string[],
    messageAnalysis: any
  ): Promise<ConversationalRAGResponse> {
    try {
      const systemPrompt = `You are a helpful customer service assistant for KarjiStore, specializing in premium perfumes, watches, and luxury gifts.

Conversation Context:
- Current topic: ${context.conversationState.currentTopic}
- User preferences: ${JSON.stringify(context.userPreferences)}
- Last product mentioned: ${context.conversationState.lastProductMentioned?.title || 'None'}
- Last category discussed: ${context.conversationState.lastCategoryDiscussed || 'None'}

Recent conversation:
${relevantHistory.join('\n')}

Current message intent: ${messageAnalysis.intent}
Is follow-up: ${messageAnalysis.isFollowUp}

Provide a helpful, contextual response that:
1. Acknowledges the conversation context
2. Addresses the user's current needs
3. Asks relevant follow-up questions when appropriate
4. Maintains a conversational tone

Respond naturally and conversationally.`;

      const response = await aiService.generateResponse([
        { role: 'user', content: userMessage }
      ], systemPrompt);

      // Generate follow-up questions based on context
      const followUpQuestions = this.generateFollowUpQuestions(context, messageAnalysis);

      return {
        answer: response,
        context: {
          conversationState: context.conversationState.currentTopic,
          relevantHistory,
          userPreferences: context.userPreferences,
          followUpQuestions
        },
        shouldAskFollowUp: followUpQuestions.length > 0,
        followUpQuestions,
        confidence: messageAnalysis.confidence,
        debug: {
          contextUsed: relevantHistory,
          conversationFlow: context.conversationState.currentTopic,
          reasoning: `Intent: ${messageAnalysis.intent}, Follow-up: ${messageAnalysis.isFollowUp}`
        }
      };
    } catch (error) {
      console.error('Error generating contextual response:', error);
      return {
        answer: "I understand your message. How can I help you today?",
        context: {
          conversationState: context.conversationState.currentTopic,
          relevantHistory,
          userPreferences: context.userPreferences,
          followUpQuestions: []
        },
        shouldAskFollowUp: false,
        followUpQuestions: [],
        confidence: 0.5,
        debug: {
          contextUsed: relevantHistory,
          conversationFlow: context.conversationState.currentTopic,
          reasoning: 'Fallback response due to error'
        }
      };
    }
  }

  /**
   * Generate follow-up questions based on context
   */
  private generateFollowUpQuestions(
    context: ConversationalContext,
    messageAnalysis: any
  ): string[] {
    const questions: string[] = [];

    switch (messageAnalysis.intent) {
      case 'product_search':
        if (!context.userPreferences.budget) {
          questions.push("What's your budget range for this purchase?");
        }
        if (!context.userPreferences.style) {
          questions.push("What style are you looking for - casual, formal, or luxury?");
        }
        if (!context.userPreferences.gender) {
          questions.push("Is this for men, women, or unisex?");
        }
        break;
      case 'order_tracking':
        if (!context.conversationState.collectedInfo.email) {
          questions.push("Could you provide your email address for order tracking?");
        }
        if (!context.conversationState.collectedInfo.order_id) {
          questions.push("What's your order ID or order number?");
        }
        break;
      case 'preference_collection':
        if (!context.userPreferences.budget) {
          questions.push("What's your preferred budget range?");
        }
        if (!context.userPreferences.style) {
          questions.push("What's your preferred style?");
        }
        break;
    }

    return questions.slice(0, 2); // Limit to 2 questions
  }

  /**
   * Update context with assistant response
   */
  private updateContextWithResponse(
    context: ConversationalContext,
    response: ConversationalRAGResponse
  ): void {
    context.conversationHistory.push({
      role: 'assistant',
      content: response.answer,
      timestamp: new Date(),
      intent: 'response',
      entities: {}
    });

    // Update conversation flow
    if (response.shouldAskFollowUp) {
      context.conversationState.pendingQuestions = response.followUpQuestions;
    }
  }

  /**
   * Save conversation to storage
   */
  private async saveConversationToStorage(
    sessionId: string,
    userMessage: string,
    assistantResponse: string
  ): Promise<void> {
    try {
      await vectorStorage.saveChatMessage(sessionId, {
        content: userMessage,
        isBot: false
      });
      
      await vectorStorage.saveChatMessage(sessionId, {
        content: assistantResponse,
        isBot: true
      });
    } catch (error) {
      console.error('Error saving conversation to storage:', error);
    }
  }

  /**
   * Get conversation context for external use
   */
  getConversationContext(sessionId: string): ConversationalContext | null {
    return this.conversationContexts.get(sessionId) || null;
  }

  /**
   * Clear conversation context
   */
  clearConversationContext(sessionId: string): void {
    this.conversationContexts.delete(sessionId);
  }
}

export const conversationalRagService = new ConversationalRAGService(); 