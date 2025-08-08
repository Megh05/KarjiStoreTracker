/**
 * Agent-based system for intelligent product recommendations
 * 
 * This system implements a ReAct (Reasoning + Acting) pattern for more intelligent
 * and autonomous handling of user queries. Instead of a rigid pipeline with multiple
 * separate LLM calls, this system gives the LLM more agency to decide what information
 * it needs and what actions to take.
 */

import { aiService } from './ai-service';
import { vectorStorage } from './vector-storage';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the agent's memory structure
interface AgentMemory {
  userPreferences: {
    category?: string;
    gender?: string;
    style?: string;
    budget?: {
      min?: number;
      max?: number;
      description?: string;
    };
    occasion?: string;
    brands?: string[];
    features?: string[];
  };
  conversationContext: {
    recentMessages: Array<{
      role: 'user' | 'assistant';
      content: string;
      timestamp: Date;
    }>;
    currentTopic?: string;
    lastQuestion?: string;
  };
  productContext: {
    recentlyViewedProducts: any[];
    recommendedProducts: any[];
    filteredProducts: any[];
  };
  sessionInfo: {
    sessionId: string;
    startTime: Date;
    interactionCount: number;
  };
}

// Define the agent's tools
interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute: (params: Record<string, any>, memory: AgentMemory) => Promise<any>;
}

// Define the agent's response
interface AgentResponse {
  message: string;
  products?: any[];
  shouldStartProductFlow?: boolean;
  confidence?: number;
  sources?: Array<{ title: string; url?: string }>;
  debug?: Record<string, any>;
}

export class AgentSystem {
  private sessionMemories: Map<string, AgentMemory> = new Map();
  private tools: Map<string, AgentTool> = new Map();
  
  constructor() {
    this.initializeTools();
  }
  
  /**
   * Initialize the agent's tools
   */
  private initializeTools() {
    // Search products tool
    this.tools.set('search_products', {
      name: 'search_products',
      description: 'Search for products based on query and filters',
      parameters: {
        query: 'string',
        filters: {
          category: 'string?',
          gender: 'string?',
          minPrice: 'number?',
          maxPrice: 'number?',
          budget: 'string?',  // Added budget parameter for natural language budget constraints
          brands: 'string[]?',
          features: 'string[]?'
        },
        limit: 'number?'
      },
      execute: async (params, memory) => {
        const { query, filters, limit = 8 } = params;
        
        console.log(`Searching products with query: "${query}" and filters:`, filters);
        
        // Parse budget if provided
        if (filters.budget && (!filters.minPrice && !filters.maxPrice)) {
          try {
            const budgetTool = this.tools.get('parse_budget');
            if (budgetTool) {
              const budgetResult = await budgetTool.execute({ text: filters.budget }, memory);
              console.log(`Parsed budget constraint:`, budgetResult);
              
              // Apply the parsed budget constraints
              if (budgetResult.min > 0) {
                filters.minPrice = budgetResult.min;
              }
              if (budgetResult.max < Infinity) {
                filters.maxPrice = budgetResult.max;
              }
            }
          } catch (error) {
            console.error('Error parsing budget:', error);
          }
        }
        
        // Perform hybrid search for products
        const productResults = await vectorStorage.searchProducts(query, limit * 2); // Get more results to allow for filtering
        
        // Apply filters if provided
        let filteredProducts = [...productResults];
        
        if (filters) {
          // Filter by category
          if (filters.category) {
            filteredProducts = filteredProducts.filter(product => {
              const productCategory = (product.metadata?.category || '').toLowerCase();
              const productTitle = (product.metadata?.title || '').toLowerCase();
              const productContent = (product.content || '').toLowerCase();
              
              return productCategory.includes(filters.category.toLowerCase()) ||
                     productTitle.includes(filters.category.toLowerCase()) ||
                     productContent.includes(filters.category.toLowerCase());
            });
          }
          
          // Filter by gender
          if (filters.gender) {
            filteredProducts = filteredProducts.filter(product => {
              const productTitle = (product.metadata?.title || '').toLowerCase();
              const productContent = (product.content || '').toLowerCase();
              
              if (filters.gender.toLowerCase() === 'men' || filters.gender.toLowerCase() === 'male') {
                return productTitle.includes('men') || 
                       productContent.includes('men') || 
                       productTitle.includes('male') || 
                       productContent.includes('male');
              } else if (filters.gender.toLowerCase() === 'women' || filters.gender.toLowerCase() === 'female') {
                return productTitle.includes('women') || 
                       productContent.includes('women') || 
                       productTitle.includes('female') || 
                       productContent.includes('female');
              }
              
              return true;
            });
          }
          
          // Filter by price
          if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
            const minPrice = filters.minPrice !== undefined ? filters.minPrice : 0;
            const maxPrice = filters.maxPrice !== undefined ? filters.maxPrice : Infinity;
            
            console.log(`Applying price filter: min=${minPrice}, max=${maxPrice}`);
            
            filteredProducts = filteredProducts.filter(product => {
              let price = 0;
              if (typeof product.metadata?.price === 'string') {
                price = parseFloat(product.metadata.price);
              } else if (typeof product.metadata?.price === 'number') {
                price = product.metadata.price;
              }
              
              const isWithinRange = price >= minPrice && price <= maxPrice;
              console.log(`Product: ${product.metadata?.title}, Price: ${price}, Within range: ${isWithinRange}`);
              return isWithinRange;
            });
            
            console.log(`After price filtering: ${filteredProducts.length} products remain`);
          }
          
          // Filter by brands
          if (filters.brands && filters.brands.length > 0) {
            filteredProducts = filteredProducts.filter(product => {
              const productBrand = (product.metadata?.brand || '').toLowerCase();
              const productTitle = (product.metadata?.title || '').toLowerCase();
              
              return filters.brands.some((brand: string) => 
                productBrand.includes(brand.toLowerCase()) || 
                productTitle.includes(brand.toLowerCase())
              );
            });
          }
        }
        
        // Format products for display
        const formattedProducts = filteredProducts.map(product => ({
          title: product.metadata?.title || 'Unknown Product',
          description: product.content || 'No description available',
          price: typeof product.metadata?.price === 'string' ? 
                 parseFloat(product.metadata.price) : 
                 (product.metadata?.price || 0),
          imageUrl: product.metadata?.imageUrl || null,
          productUrl: product.metadata?.productUrl || '#',
          brand: product.metadata?.brand || null,
          category: product.metadata?.category || null
        }));
        
        // Update memory with filtered products
        memory.productContext.filteredProducts = formattedProducts;
        
        return {
          products: formattedProducts,
          count: formattedProducts.length,
          filters: filters || {}
        };
      }
    });
    
    // Get product details tool
    this.tools.set('get_product_details', {
      name: 'get_product_details',
      description: 'Get detailed information about a specific product',
      parameters: {
        productId: 'string'
      },
      execute: async (params, memory) => {
        const { productId } = params;
        
        // Find product in memory first
        const productInMemory = memory.productContext.filteredProducts.find(p => 
          p.id === productId || p.title.toLowerCase().includes(productId.toLowerCase())
        );
        
        if (productInMemory) {
          return productInMemory;
        }
        
        // If not in memory, search for it
        const productResults = await vectorStorage.searchProducts(productId, 1);
        
        if (productResults.length > 0) {
          const product = productResults[0];
          
          return {
            title: product.metadata?.title || 'Unknown Product',
            description: product.content || 'No description available',
            price: typeof product.metadata?.price === 'string' ? 
                   parseFloat(product.metadata.price) : 
                   (product.metadata?.price || 0),
            imageUrl: product.metadata?.imageUrl || null,
            productUrl: product.metadata?.productUrl || '#',
            brand: product.metadata?.brand || null,
            category: product.metadata?.category || null
          };
        }
        
        return null;
      }
    });
    
    // Parse budget tool
    this.tools.set('parse_budget', {
      name: 'parse_budget',
      description: 'Parse budget information from text',
      parameters: {
        text: 'string'
      },
      execute: async (params, memory) => {
        const { text } = params;
        const lowerText = text.toLowerCase();
        
        let min = 0;
        let max = Infinity;
        let description = '';
        
        console.log(`Parsing budget from: "${text}"`);
        
        // Extract numeric values from text
        const numericValues = lowerText.match(/\d+/g);
        
        // Check for "under X" pattern
        const underMatch = lowerText.match(/under\s+(\d+)/i);
        if (underMatch) {
          max = parseInt(underMatch[1], 10);
          description = `under ${max}`;
          console.log(`Detected "under ${max}" budget constraint`);
          return { min, max, description };
        }
        
        // Check for "less than X" pattern
        const lessThanMatch = lowerText.match(/less\s+than\s+(\d+)/i);
        if (lessThanMatch) {
          max = parseInt(lessThanMatch[1], 10);
          description = `less than ${max}`;
          console.log(`Detected "less than ${max}" budget constraint`);
          return { min, max, description };
        }
        
        // Check for "between X and Y" pattern
        const betweenMatch = lowerText.match(/between\s+(\d+)\s+and\s+(\d+)/i);
        if (betweenMatch) {
          min = parseInt(betweenMatch[1], 10);
          max = parseInt(betweenMatch[2], 10);
          description = `between ${min} and ${max}`;
          console.log(`Detected "between ${min} and ${max}" budget constraint`);
          return { min, max, description };
        }
        
        // Check for "more than X" pattern
        const moreThanMatch = lowerText.match(/more\s+than\s+(\d+)/i);
        if (moreThanMatch) {
          min = parseInt(moreThanMatch[1], 10);
          description = `more than ${min}`;
          console.log(`Detected "more than ${min}" budget constraint`);
          return { min, max, description };
        }
        
        // Check for "X to Y" pattern
        const rangeMatch = lowerText.match(/(\d+)\s+to\s+(\d+)/i);
        if (rangeMatch) {
          min = parseInt(rangeMatch[1], 10);
          max = parseInt(rangeMatch[2], 10);
          description = `${min} to ${max}`;
          console.log(`Detected "${min} to ${max}" budget constraint`);
          return { min, max, description };
        }
        
        // Simple number with currency (e.g., "300 aed")
        if (numericValues && numericValues.length === 1 && 
            (lowerText.includes('aed') || lowerText.includes('$') || lowerText.includes('dollar'))) {
          max = parseInt(numericValues[0], 10);
          description = `under ${max}`;
          console.log(`Detected simple price limit: ${max}`);
          return { min, max, description };
        }
        
        // Check for predefined ranges
        if (lowerText.includes('budget') || lowerText.includes('cheap') || lowerText.includes('affordable')) {
          max = 100;
          description = 'budget-friendly';
          console.log(`Detected "budget-friendly" constraint: max=${max}`);
          return { min, max, description };
        }
        
        if (lowerText.includes('mid') || lowerText.includes('moderate')) {
          min = 100;
          max = 300;
          description = 'mid-range';
          console.log(`Detected "mid-range" constraint: min=${min}, max=${max}`);
          return { min, max, description };
        }
        
        if (lowerText.includes('premium') || lowerText.includes('luxury') || lowerText.includes('high-end')) {
          min = 300;
          description = 'premium';
          console.log(`Detected "premium" constraint: min=${min}`);
          return { min, max, description };
        }
        
        console.log(`No specific budget constraint detected, using default: any price`);
        return { min, max, description: 'any' };
      }
    });
    
    // Save preferences tool
    this.tools.set('save_preferences', {
      name: 'save_preferences',
      description: 'Save user preferences to memory',
      parameters: {
        preferences: {
          category: 'string?',
          gender: 'string?',
          style: 'string?',
          budget: 'object?',
          occasion: 'string?',
          brands: 'string[]?',
          features: 'string[]?'
        }
      },
      execute: async (params, memory) => {
        const { preferences } = params;
        
        // Update memory with new preferences
        if (preferences.category) memory.userPreferences.category = preferences.category;
        if (preferences.gender) memory.userPreferences.gender = preferences.gender;
        if (preferences.style) memory.userPreferences.style = preferences.style;
        if (preferences.budget) memory.userPreferences.budget = preferences.budget;
        if (preferences.occasion) memory.userPreferences.occasion = preferences.occasion;
        if (preferences.brands) memory.userPreferences.brands = preferences.brands;
        if (preferences.features) memory.userPreferences.features = preferences.features;
        
        return {
          success: true,
          updatedPreferences: memory.userPreferences
        };
      }
    });
    
    // Get knowledge tool
    this.tools.set('get_knowledge', {
      name: 'get_knowledge',
      description: 'Get knowledge from the knowledge base',
      parameters: {
        query: 'string',
        limit: 'number?'
      },
      execute: async (params, memory) => {
        const { query, limit = 3 } = params;
        
        // Search knowledge base
        const knowledgeResults = await vectorStorage.searchKnowledge(query, limit);
        
        return knowledgeResults.map(result => ({
          title: result.metadata?.title || 'Unknown Source',
          content: result.content,
          source: result.metadata?.source,
          url: result.metadata?.sourceUrl
        }));
      }
    });
  }
  
  /**
   * Process a user query using the agent system
   */
  public async processQuery(query: string, sessionId: string): Promise<AgentResponse> {
    // Initialize or get memory for this session
    const memory = this.getOrCreateMemory(sessionId);
    
    // Add user message to memory
    memory.conversationContext.recentMessages.push({
      role: 'user',
      content: query,
      timestamp: new Date()
    });
    
    // Increment interaction count
    memory.sessionInfo.interactionCount++;
    
    // Create the agent prompt
    const agentPrompt = this.createAgentPrompt(query, memory);
    
    // Execute the agent
    const agentResponse = await this.executeAgent(agentPrompt, query, memory);
    
    // Save the agent's response to memory
    memory.conversationContext.recentMessages.push({
      role: 'assistant',
      content: agentResponse.message,
      timestamp: new Date()
    });
    
    // Save conversation to file
    await this.saveConversation(sessionId, query, agentResponse.message);
    
    return agentResponse;
  }
  
  /**
   * Create the agent prompt with full context
   */
  private createAgentPrompt(query: string, memory: AgentMemory): string {
    return `
# Agent Task
You are an intelligent shopping assistant for KarjiStore, a luxury retail store specializing in perfumes, watches, and jewelry.
Your goal is to help the user find products that match their preferences and provide helpful information.

# User Query
"${query}"

# Conversation History
${memory.conversationContext.recentMessages.slice(-5).map(msg => 
  `${msg.role.toUpperCase()}: ${msg.content}`
).join('\n')}

# User Preferences
${JSON.stringify(memory.userPreferences, null, 2)}

# Available Tools
${Array.from(this.tools.values()).map(tool => 
  `## ${tool.name}\n${tool.description}\nParameters: ${JSON.stringify(tool.parameters, null, 2)}`
).join('\n\n')}

# Instructions
1. THINK about what the user is asking for and what information you need
2. DECIDE which tools you need to use to fulfill the request
3. ACT by calling the necessary tools in the correct sequence
4. OBSERVE the results of your actions
5. RESPOND to the user with a helpful message

Your response must be in the following format:

THINKING: <your reasoning about what the user wants and how to help them>

ACTIONS:
\`\`\`json
[
  {
    "tool": "tool_name",
    "parameters": {
      "param1": "value1",
      "param2": "value2"
    }
  },
  ...more actions if needed
]
\`\`\`

RESPONSE: <your response to the user>

PRODUCTS: <true/false whether to include products in the response>

IMPORTANT: If the user is asking about products, perfumes, or any shopping-related query, always set PRODUCTS to true, even if you don't have specific products to show yet.

If you don't need to use any tools, provide an empty array for ACTIONS.
`;
  }
  
  /**
   * Execute the agent with the given prompt
   */
  private async executeAgent(prompt: string, query: string, memory: AgentMemory): Promise<AgentResponse> {
    // Call the LLM with the agent prompt
    const messages = [
      { role: 'system', content: prompt },
      { role: 'user', content: query }
    ];
    
    const response = await aiService.generateResponse(messages);
    
    // Parse the agent's response
    const thinking = this.extractSection(response, 'THINKING');
    const actionsJson = this.extractJsonFromSection(response, 'ACTIONS');
    const responseText = this.extractSection(response, 'RESPONSE');
    const includeProducts = this.extractSection(response, 'PRODUCTS').toLowerCase() === 'true';
    
    console.log('Agent thinking:', thinking);
    
    let products: any[] = [];
    let sources: Array<{ title: string; url?: string }> = [];
    
    // Execute actions if any
    if (actionsJson && actionsJson.length > 0) {
      for (const action of actionsJson) {
        const tool = this.tools.get(action.tool);
        
        if (tool) {
          console.log(`Executing tool: ${action.tool} with parameters:`, action.parameters);
          
          const result = await tool.execute(action.parameters, memory);
          
          console.log(`Tool ${action.tool} result:`, result);
          
          // Collect products if this tool returns them
          if (result && result.products) {
            products = [...products, ...result.products];
          }
          
          // Collect sources if this tool returns them
          if (result && result.sources) {
            sources = [...sources, ...result.sources];
          }
        } else {
          console.warn(`Unknown tool: ${action.tool}`);
        }
      }
    }
    
    // If we should include products but none were found through actions,
    // try to get them from memory
    if (includeProducts && products.length === 0 && memory.productContext.filteredProducts.length > 0) {
      products = memory.productContext.filteredProducts.slice(0, 8);
    }
    
    // Limit to 8 products
    products = products.slice(0, 8);
    
    // Debug products
    console.log(`Agent response includes products: ${includeProducts}`);
    console.log(`Number of products: ${products.length}`);
    if (products.length > 0) {
      console.log(`First product: ${JSON.stringify(products[0])}`);
    }
    
    // If no products found but we should include them, let's search for some default ones
    if (includeProducts && products.length === 0) {
      console.log("No products found but includeProducts is true, searching for default products");
      try {
        // Determine the category to search for from the actions or thinking
        let searchCategory = "product";
        if (thinking.toLowerCase().includes("watch")) {
          searchCategory = "watch";
        } else if (thinking.toLowerCase().includes("perfume")) {
          searchCategory = "perfume";
        } else if (thinking.toLowerCase().includes("jewelry")) {
          searchCategory = "jewelry";
        }
        
        console.log(`Using category "${searchCategory}" for fallback search`);
        const searchResults = await vectorStorage.searchProducts(searchCategory, 16); // Get more results to allow filtering
        
        if (searchResults.length > 0) {
          // Apply the same price filters to fallback results
          let filteredResults = [...searchResults];
          
          // Extract minPrice and maxPrice from actions if available
          let minPrice = 0;
          let maxPrice = Infinity;
          
          if (actionsJson && actionsJson.length > 0) {
            for (const action of actionsJson) {
              if (action.tool === 'search_products' && action.parameters && action.parameters.filters) {
                if (action.parameters.filters.minPrice !== undefined) {
                  minPrice = action.parameters.filters.minPrice;
                }
                if (action.parameters.filters.maxPrice !== undefined) {
                  maxPrice = action.parameters.filters.maxPrice;
                }
              }
            }
          }
          
          console.log(`Applying price filter to fallback results: min=${minPrice}, max=${maxPrice}`);
          
          // Filter by price
          if (minPrice > 0 || maxPrice < Infinity) {
            filteredResults = filteredResults.filter(product => {
              let price = 0;
              if (typeof product.metadata?.price === 'string') {
                price = parseFloat(product.metadata.price);
              } else if (typeof product.metadata?.price === 'number') {
                price = product.metadata.price;
              }
              
              const isWithinRange = price >= minPrice && price <= maxPrice;
              console.log(`Fallback product: ${product.metadata?.title}, Price: ${price}, Within range: ${isWithinRange}`);
              return isWithinRange;
            });
            
            console.log(`After price filtering fallback results: ${filteredResults.length} products remain`);
          }
          
          // Map to standard product format
          products = filteredResults.slice(0, 8).map(product => ({
            title: product.metadata?.title || 'Unknown Product',
            description: product.content || 'No description available',
            price: typeof product.metadata?.price === 'string' ? 
                   parseFloat(product.metadata.price) : 
                   (product.metadata?.price || 0),
            imageUrl: product.metadata?.imageUrl || null,
            productUrl: product.metadata?.productUrl || '#',
            brand: product.metadata?.brand || null,
            category: product.metadata?.category || null
          }));
          
          console.log(`Found ${products.length} filtered default products`);
        }
      } catch (error) {
        console.error("Error searching for default products:", error);
      }
    }
    
    return {
      message: responseText,
      products: includeProducts ? products : undefined,
      shouldStartProductFlow: false, // The agent decides whether to show products directly
      confidence: 0.9,
      sources,
      debug: {
        thinking,
        actions: actionsJson
      }
    };
  }
  
  /**
   * Extract a section from the agent's response
   */
  private extractSection(text: string, sectionName: string): string {
    const regex = new RegExp(`${sectionName}:\\s*(.+?)(?=\\n\\n|\\n[A-Z]+:|$)`, 's');
    const match = text.match(regex);
    return match ? match[1].trim() : '';
  }
  
  /**
   * Extract JSON from a section in the agent's response
   */
  private extractJsonFromSection(text: string, sectionName: string): any[] {
    const section = this.extractSection(text, sectionName);
    
    // Find JSON content between triple backticks
    const jsonMatch = section.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch (error) {
        console.error('Error parsing JSON:', error);
        return [];
      }
    }
    
    return [];
  }
  
  /**
   * Get or create memory for a session
   */
  private getOrCreateMemory(sessionId: string): AgentMemory {
    if (!this.sessionMemories.has(sessionId)) {
      this.sessionMemories.set(sessionId, {
        userPreferences: {},
        conversationContext: {
          recentMessages: []
        },
        productContext: {
          recentlyViewedProducts: [],
          recommendedProducts: [],
          filteredProducts: []
        },
        sessionInfo: {
          sessionId,
          startTime: new Date(),
          interactionCount: 0
        }
      });
      
      // Load previous conversation if available
      this.loadConversation(sessionId);
    }
    
    return this.sessionMemories.get(sessionId)!;
  }
  
  /**
   * Load conversation from file
   */
  private async loadConversation(sessionId: string): Promise<void> {
    try {
      const memory = this.sessionMemories.get(sessionId)!;
      const filePath = path.join(__dirname, '../../data-storage', `chat-session-${sessionId}.json`);
      
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        const messages = JSON.parse(data);
        
        // Convert messages to memory format
        const recentMessages = messages.map((msg: any) => ({
          role: msg.isBot ? 'assistant' : 'user',
          content: msg.content,
          timestamp: new Date(msg.timestamp)
        }));
        
        memory.conversationContext.recentMessages = recentMessages;
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
    }
  }
  
  /**
   * Save conversation to file
   */
  private async saveConversation(sessionId: string, userMessage: string, botMessage: string): Promise<void> {
    try {
      const filePath = path.join(__dirname, '../../data-storage', `chat-session-${sessionId}.json`);
      
      // Read existing messages or create new array
      let messages: any[] = [];
      
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        messages = JSON.parse(data);
      }
      
      // Add new messages
      messages.push({
        content: userMessage,
        isBot: false,
        timestamp: new Date().toISOString()
      });
      
      messages.push({
        content: botMessage,
        isBot: true,
        timestamp: new Date().toISOString()
      });
      
      // Write back to file
      fs.writeFileSync(filePath, JSON.stringify(messages, null, 2));
    } catch (error) {
      console.error('Error saving conversation:', error);
    }
  }
}

// Create and export an instance of the AgentSystem
export const agentSystem = new AgentSystem();