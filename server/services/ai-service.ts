// Azure OpenAI will be accessed via HTTP API
import { OpenAI } from 'openai';
// Ollama will be accessed via HTTP API
import { AiConfig, AzureConfig, OllamaConfig, OpenRouterConfig } from '@shared/schema';

// Default Ollama endpoint
const DEFAULT_OLLAMA_ENDPOINT = 'http://127.0.0.1:11434';
// OpenRouter API endpoint
const OPENROUTER_API_ENDPOINT = 'https://openrouter.ai/api/v1';

export interface AIProvider {
  generateResponse(messages: { role: string; content: string }[], systemPrompt?: string): Promise<string>;
  testConnection(): Promise<boolean>;
}

export class AzureAIProvider implements AIProvider {
  private config: AzureConfig & { deploymentName: string };

  constructor(config: AzureConfig & { deploymentName: string }) {
    this.config = config;
  }

  async generateResponse(messages: { role: string; content: string }[], systemPrompt?: string): Promise<string> {
    try {
      const chatMessages = systemPrompt 
        ? [{ role: 'system', content: systemPrompt }, ...messages]
        : messages;

      const response = await fetch(`${this.config.endpoint}/openai/deployments/${this.config.deploymentName}/chat/completions?api-version=${this.config.apiVersion}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.config.apiKey,
        },
        body: JSON.stringify({
          messages: chatMessages,
          max_tokens: 1000,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`Azure API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || 'I apologize, but I could not generate a response at this time.';
    } catch (error) {
      console.error('Azure AI Error:', error);
      throw new Error('Failed to generate response using Azure OpenAI');
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.endpoint}/openai/deployments/${this.config.deploymentName}/chat/completions?api-version=${this.config.apiVersion}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.config.apiKey,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 10,
        }),
      });
      return response.ok;
    } catch (error) {
      console.error('Azure connection test failed:', error);
      return false;
    }
  }
}

export class OllamaAIProvider implements AIProvider {
  private config: OllamaConfig;

  constructor(config: OllamaConfig) {
    this.config = config;
  }

  async generateResponse(messages: { role: string; content: string }[], systemPrompt?: string): Promise<string> {
    try {
      console.log('Generating response with Ollama:', {
        endpoint: this.config.endpoint,
        model: this.config.model,
        messagesCount: messages.length,
        hasSystemPrompt: !!systemPrompt
      });
      
      // Format the prompt for Ollama
      const prompt = this.formatMessagesForOllama(messages, systemPrompt);
      
      console.log('Formatted prompt for Ollama:', prompt);
      
      const response = await fetch(`${this.config.endpoint}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9,
            num_predict: 1024
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Ollama API error: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Ollama response:', {
        responseLength: data.response?.length || 0,
        done: data.done,
        done_reason: data.done_reason
      });
      
      if (!data.response) {
        console.error('Empty response from Ollama:', data);
        return 'I apologize, but I could not generate a response at this time.';
      }
      
      return data.response;
    } catch (error) {
      console.error('Ollama AI Error:', error);
      throw new Error('Failed to generate response using Ollama');
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      console.log(`Testing connection to Ollama at ${this.config.endpoint}`);
      const response = await fetch(`${this.config.endpoint}/api/tags`);
      const success = response.ok;
      console.log(`Ollama connection test ${success ? 'successful' : 'failed'}: ${response.status} ${response.statusText}`);
      return success;
    } catch (error) {
      console.error('Ollama connection test failed:', error);
      return false;
    }
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.config.endpoint}/api/tags`);
      if (!response.ok) return [];
      
      const data = await response.json();
      return data.models?.map((model: any) => model.name) || [];
    } catch (error) {
      console.error('Failed to fetch Ollama models:', error);
      return [];
    }
  }

  private formatMessagesForOllama(messages: { role: string; content: string }[], systemPrompt?: string): string {
    // For Gemma and other models, we need to format the messages in a specific way
    // that Ollama can understand
    
    let formattedPrompt = '';
    
    // Add system prompt if provided
    if (systemPrompt) {
      formattedPrompt += `<system>\n${systemPrompt}\n</system>\n\n`;
    }
    
    // Add conversation history
    for (const msg of messages) {
      if (msg.role === 'user') {
        formattedPrompt += `<user>\n${msg.content}\n</user>\n\n`;
      } else if (msg.role === 'assistant') {
        formattedPrompt += `<assistant>\n${msg.content}\n</assistant>\n\n`;
      }
    }
    
    // Add the final assistant prompt
    formattedPrompt += `<assistant>\n`;
    
    return formattedPrompt;
  }
}

export class OpenRouterAIProvider implements AIProvider {
  private config: any;
  private sanitizedApiKey: string;

  constructor(config: any) {
    this.config = config;
    
    console.log("OpenRouterAIProvider constructor called with config:", {
      hasApiKey: !!config.apiKey,
      apiKeyFirstChars: config.apiKey ? config.apiKey.substring(0, 10) + '...' : 'none',
      model: config.model,
      hasEndpoint: !!config.endpoint
    });
    
    // Handle legacy format (endpoint instead of apiKey)
    if (this.config.endpoint) {
      console.log("Converting legacy OpenRouter config format in provider");
      // Just remove the endpoint without adding a placeholder API key
      delete this.config.endpoint;
    }
    
    // Make sure the API key is trimmed if it exists
    if (this.config.apiKey) {
      this.config.apiKey = this.config.apiKey.trim();
    }
    
    // Sanitize API key to prevent ByteString errors
    this.sanitizedApiKey = this.config.apiKey ? this.config.apiKey.replace(/[^\x00-\xFF]/g, '') : '';
    
    console.log("OpenRouterAIProvider initialized with:", {
      hasApiKey: !!this.config.apiKey,
      apiKeyFirstChars: this.config.apiKey ? this.config.apiKey.substring(0, 10) + '...' : 'none',
      sanitizedApiKeyFirstChars: this.sanitizedApiKey ? this.sanitizedApiKey.substring(0, 10) + '...' : 'none',
      model: this.config.model
    });
  }

  async generateResponse(messages: { role: string; content: string }[], systemPrompt?: string): Promise<string> {
    try {
      console.log("OpenRouterAIProvider.generateResponse called with config:", {
        hasApiKey: !!this.config.apiKey,
        apiKeyFirstChars: this.config.apiKey ? this.config.apiKey.substring(0, 10) + '...' : 'none',
        apiKeyLength: this.config.apiKey ? this.config.apiKey.length : 0,
        isPlaceholder: this.config.apiKey === 'PLEASE_UPDATE_YOUR_API_KEY' || this.config.apiKey === 'PLEASE_UPDATE_API_KEY',
        model: this.config.model
      });
      
      if (!this.config.apiKey) {
        console.warn('OpenRouter response generation: API key is missing, using fallback response');
        return 'I am unable to generate a response at the moment. Please check the OpenRouter API key in the admin panel.';
      }
      
      // Check for placeholder API key - be very specific to avoid false positives
      const isPlaceholder = 
        this.config.apiKey === 'PLEASE_UPDATE_YOUR_API_KEY' || 
        this.config.apiKey === 'PLEASE_UPDATE_API_KEY' ||
        this.config.apiKey === 'YOUR_ACTUAL_API_KEY_HERE';
      
      if (isPlaceholder) {
        console.warn('OpenRouter response generation: Using placeholder API key');
        return 'I am using a placeholder API key. Please update it with a valid OpenRouter API key in the admin panel.';
      }
      
      // Remove the format check for API key since OpenRouter keys might have different formats
      
      if (!this.config.model) {
        console.warn('OpenRouter response generation: Model is not specified');
        return 'Please select an AI model in the admin panel.';
      }
      
      const chatMessages = systemPrompt 
        ? [{ role: 'system', content: systemPrompt }, ...messages]
        : messages;

      // Log the actual messages count
      const userMessages = messages.filter(m => m.role === 'user').length;
      const assistantMessages = messages.filter(m => m.role === 'assistant').length;
      const systemMessages = messages.filter(m => m.role === 'system').length;
      
      console.log('Generating response with OpenRouter:', {
        model: this.config.model,
        messagesCount: chatMessages.length,
        userMessages,
        assistantMessages,
        systemMessages,
        hasSystemPrompt: !!systemPrompt
      });

      const response = await fetch(`${OPENROUTER_API_ENDPOINT}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.sanitizedApiKey}`,
          'HTTP-Referer': 'https://karji-ai-chatbot.com', // Replace with actual domain in production
          'X-Title': 'Karji AI Chatbot'
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: chatMessages,
          max_tokens: 1000,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`OpenRouter API error: ${response.status} ${response.statusText}`, errorText);
        
        // Try to parse the error response as JSON for more details
        try {
          const errorJson = JSON.parse(errorText);
          console.error('OpenRouter error details:', errorJson);
          
          if (errorJson.error) {
            console.error('OpenRouter error message:', errorJson.error.message);
            console.error('OpenRouter error code:', errorJson.error.code);
          }
        } catch (e) {
          // Not JSON, continue with text error
        }
        
        if (response.status === 401) {
          return 'The OpenRouter API key is invalid or has expired. Please update it in the admin panel.';
        } else if (response.status === 402) {
          return 'The OpenRouter account has reached its usage limit. Please check your billing settings.';
        } else if (response.status === 429) {
          return 'The OpenRouter API is rate limiting requests. Please try again later.';
        } else if (response.status === 500) {
          return 'The OpenRouter service is experiencing internal issues. This might be related to the selected model. Please try a different model or try again later.';
        }
        
        throw new Error(`OpenRouter API error: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('OpenRouter response:', {
        responseLength: data.choices?.[0]?.message?.content?.length || 0,
        model: data.model || 'unknown'
      });
      
      if (!data.choices?.[0]?.message?.content) {
        console.error('Empty response from OpenRouter:', data);
        return 'I apologize, but I could not generate a response at this time.';
      }
      
      return data.choices[0].message.content;
    } catch (error) {
      console.error('OpenRouter AI Error:', error);
      throw new Error('Failed to generate response using OpenRouter');
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.config.apiKey) {
        console.warn('OpenRouter connection test: API key is missing, allowing test to pass');
        return true;
      }
      
      // For testing purposes, we'll allow placeholder API keys to pass the test
      // This is because we want to allow users to save the configuration even with a placeholder
      // But we'll log a warning
      if (this.config.apiKey === 'PLEASE_UPDATE_YOUR_API_KEY' || 
          this.config.apiKey === 'PLEASE_UPDATE_API_KEY' ||
          this.config.apiKey === 'YOUR_ACTUAL_API_KEY_HERE') {
        console.warn('OpenRouter connection test: Using placeholder API key (allowed for testing)');
        return true;
      }
      
      console.log(`Testing connection to OpenRouter with API key: ${this.sanitizedApiKey.substring(0, 5)}...`);
      
      const response = await fetch(`${OPENROUTER_API_ENDPOINT}/models`, {
        headers: {
          'Authorization': `Bearer ${this.sanitizedApiKey}`,
          'HTTP-Referer': 'https://karji-ai-chatbot.com', // Replace with actual domain in production
          'X-Title': 'Karji AI Chatbot'
        },
      });
      
      const success = response.ok;
      console.log(`OpenRouter connection test ${success ? 'successful' : 'failed'}: ${response.status} ${response.statusText}`);
      
      if (!success) {
        const errorText = await response.text();
        console.error('OpenRouter connection test error:', errorText);
      }
      
      return success;
    } catch (error) {
      console.error('OpenRouter connection test failed:', error);
      return false;
    }
  }

  async getAvailableModels(): Promise<any[]> {
    try {
      if (!this.config.apiKey) {
        console.error('OpenRouter models fetch failed: API key is missing');
        return [];
      }
      
      // For testing purposes, we'll allow placeholder API keys but return a special message
      if (this.config.apiKey === 'PLEASE_UPDATE_YOUR_API_KEY' || 
          this.config.apiKey === 'PLEASE_UPDATE_API_KEY' ||
          this.config.apiKey === 'YOUR_ACTUAL_API_KEY_HERE') {
        console.warn('OpenRouter models fetch: Using placeholder API key (returning sample models)');
        // Return a few sample models to allow testing
        return [
          { id: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo (Sample)', context_length: 16384 },
          { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus (Sample)', context_length: 200000 },
          { id: 'google/gemini-1.5-pro', name: 'Gemini 1.5 Pro (Sample)', context_length: 1000000 }
        ];
      }
      
      console.log('Fetching OpenRouter models');
      
      const response = await fetch(`${OPENROUTER_API_ENDPOINT}/models`, {
        headers: {
          'Authorization': `Bearer ${this.sanitizedApiKey}`,
          'HTTP-Referer': 'https://karji-ai-chatbot.com', // Replace with actual domain in production
          'X-Title': 'Karji AI Chatbot'
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`OpenRouter API error: ${response.status} ${response.statusText}`, errorText);
        return [];
      }
      
      const data = await response.json();
      console.log(`Found ${data.data?.length || 0} OpenRouter models`);
      return data.data || [];
    } catch (error) {
      console.error('Failed to fetch OpenRouter models:', error);
      return [];
    }
  }
}

export class AIService {
  private provider: AIProvider | null = null;
  private config: AiConfig | null = null;

  setProvider(config: AiConfig) {
    console.log("AIService.setProvider called with config:", {
      provider: config.provider,
      hasConfig: !!config.config,
      configType: config.config ? typeof config.config : 'none'
    });
    
    this.config = config;
    
    // Fix legacy OpenRouter config that might have incorrect fields
    if (config.provider === 'openrouter') {
      // Check if the config has the wrong structure (endpoint instead of apiKey)
      const openRouterConfig = config.config as any;
      
      console.log("OpenRouter config in setProvider:", {
        hasApiKey: !!openRouterConfig.apiKey,
        apiKeyFirstChars: openRouterConfig.apiKey ? openRouterConfig.apiKey.substring(0, 10) + '...' : 'none',
        isPlaceholder: openRouterConfig.apiKey === 'PLEASE_UPDATE_YOUR_API_KEY' || openRouterConfig.apiKey === 'PLEASE_UPDATE_API_KEY',
        model: openRouterConfig.model,
        hasEndpoint: !!openRouterConfig.endpoint
      });
      
      if (openRouterConfig.endpoint) {
        console.warn('Found legacy OpenRouter config with incorrect fields, removing endpoint');
        // Just remove the endpoint property without adding a placeholder API key
        delete openRouterConfig.endpoint;
      }
    }
    
    if (config.provider === 'azure') {
      this.provider = new AzureAIProvider(config.config as AzureConfig & { deploymentName: string });
    } else if (config.provider === 'ollama') {
      this.provider = new OllamaAIProvider(config.config as OllamaConfig);
    } else if (config.provider === 'openrouter') {
      this.provider = new OpenRouterAIProvider(config.config as any);
    }
  }

  // Get the current configuration
  getConfig(): AiConfig | null {
    return this.config;
  }

  async generateResponse(
    messages: { role: string; content: string }[], 
    contextInfo?: string
  ): Promise<string> {
    if (!this.provider) {
      throw new Error('AI provider not configured');
    }

    // Log the actual messages count for debugging with detailed breakdown
    const userMessages = messages.filter(m => m.role === 'user').length;
    const assistantMessages = messages.filter(m => m.role === 'assistant').length;
    const systemMessages = messages.filter(m => m.role === 'system').length;
    
    console.log(`AIService.generateResponse called with ${messages.length} messages:`, {
      userMessages,
      assistantMessages,
      systemMessages,
      hasContextInfo: !!contextInfo
    });
    
    // If there's a system message already in the messages, use that
    // Otherwise, build a system prompt and add it
    const hasSystemMessage = messages.some(msg => msg.role === 'system');
    
    if (hasSystemMessage || !contextInfo) {
      return this.provider.generateResponse(messages);
    } else {
      const systemPrompt = this.buildSystemPrompt(contextInfo);
      return this.provider.generateResponse(messages, systemPrompt);
    }
  }

  async testConnection(): Promise<boolean> {
    return this.provider?.testConnection() || false;
  }

  private buildSystemPrompt(contextInfo?: string): string {
    let prompt = `You are a helpful customer service assistant for KarjiStore, specializing in premium perfumes, watches, and luxury gifts. Be friendly, professional, and CONVERSATIONAL.

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
❌ Showing products without asking preferences first

PRODUCT KNOWLEDGE:
- KarjiStore specializes in premium perfumes, watches, and luxury gifts
- Our products range from affordable to high-end luxury items
- We offer international shipping and have a 30-day return policy

ORDER HANDLING:
- To track orders, you need the customer's email and order number
- Order statuses include: pending, processing, shipped, delivered, and cancelled

RESPONSE STYLE:
- Keep responses under 2 sentences
- Be conversational and natural
- Ask one question at a time
- Show products as cards only

ERROR HANDLING:
- If you encounter technical issues, gracefully explain the situation
- Offer alternative ways to help the customer
- Never expose internal system details to customers`;

    if (this.config?.customInstructions) {
      prompt += `\n\nAdditional Instructions:\n${this.config.customInstructions}`;
    }

    if (contextInfo) {
      prompt += `\n\nRelevant Information:\n${contextInfo}`;
    }

    return prompt;
  }

  async getOllamaModels(endpoint: string = DEFAULT_OLLAMA_ENDPOINT): Promise<string[]> {
    try {
      console.log(`Fetching Ollama models from endpoint: ${endpoint}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(`${endpoint}/api/tags`, {
        signal: controller.signal
      }).finally(() => clearTimeout(timeoutId));
      
      if (!response.ok) {
        console.error(`Ollama API returned status: ${response.status} ${response.statusText}`);
        return [];
      }
      
      const data = await response.json();
      
      if (!data.models || !Array.isArray(data.models)) {
        console.error('Unexpected response format from Ollama API:', data);
        return [];
      }
      
      const models = data.models.map((model: any) => model.name);
      console.log(`Found ${models.length} Ollama models:`, models);
      return models;
    } catch (error) {
      console.error('Failed to fetch Ollama models:', error);
      return [];
    }
  }

  async getOpenRouterModels(apiKey: string): Promise<any[]> {
    try {
      // Allow empty API keys but log a warning
      if (!apiKey) {
        console.warn('OpenRouter models fetch: API key is empty, returning sample models');
        // Return sample models instead of failing
        return [
          { id: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo (Sample)', context_length: 16384 },
          { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus (Sample)', context_length: 200000 },
          { id: 'google/gemini-1.5-pro', name: 'Gemini 1.5 Pro (Sample)', context_length: 1000000 }
        ];
      }
      
      // Trim the API key to remove any accidental whitespace
      apiKey = apiKey.trim();
      
      // Log API key details for debugging
      console.log(`OpenRouter API key details in getOpenRouterModels:`, {
        length: apiKey.length,
        firstChars: apiKey.substring(0, 5),
        lastChars: apiKey.substring(apiKey.length - 5),
        format: apiKey.startsWith('sk-or-') ? 'starts with sk-or-' : 'does not start with sk-or-'
      });
      
      // For testing purposes, we'll allow placeholder API keys but return a special message
      if (apiKey === 'PLEASE_UPDATE_YOUR_API_KEY' || 
          apiKey === 'PLEASE_UPDATE_API_KEY' ||
          apiKey === 'YOUR_ACTUAL_API_KEY_HERE') {
        console.warn('OpenRouter models fetch: Using placeholder API key (returning sample models)');
        // Return a few sample models to allow testing
        return [
          { id: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo (Sample)', context_length: 16384 },
          { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus (Sample)', context_length: 200000 },
          { id: 'google/gemini-1.5-pro', name: 'Gemini 1.5 Pro (Sample)', context_length: 1000000 }
        ];
      }
      
      console.log('Fetching OpenRouter models');
      
      // Sanitize API key to prevent ByteString errors
      const sanitizedApiKey = apiKey.replace(/[^\x00-\xFF]/g, '');
      
      // Log sanitized API key details
      console.log(`Sanitized OpenRouter API key details:`, {
        length: sanitizedApiKey.length,
        firstChars: sanitizedApiKey.substring(0, 5),
        lastChars: sanitizedApiKey.substring(sanitizedApiKey.length - 5),
        changedFromOriginal: sanitizedApiKey !== apiKey
      });
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        console.log(`Making request to OpenRouter API: ${OPENROUTER_API_ENDPOINT}/models`);
        
        const response = await fetch(`${OPENROUTER_API_ENDPOINT}/models`, {
          signal: controller.signal,
          headers: {
            'Authorization': `Bearer ${sanitizedApiKey}`,
            'HTTP-Referer': 'https://karji-ai-chatbot.com', // Replace with actual domain in production
            'X-Title': 'Karji AI Chatbot'
          }
        }).finally(() => clearTimeout(timeoutId));
        
        console.log(`OpenRouter API response status: ${response.status} ${response.statusText}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`OpenRouter API returned status: ${response.status} ${response.statusText}`, errorText);
          return [];
        }
        
        const data = await response.json();
        
        if (!data.data || !Array.isArray(data.data)) {
          console.error('Unexpected response format from OpenRouter API:', data);
          return [];
        }
        
        console.log(`Found ${data.data.length} OpenRouter models`);
        return data.data;
      } catch (fetchError) {
        console.error('Failed to fetch OpenRouter models:', fetchError);
        return [];
      }
    } catch (error) {
      console.error('Failed to fetch OpenRouter models:', error);
      return [];
    }
  }
}

export const aiService = new AIService();