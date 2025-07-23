// Azure OpenAI will be accessed via HTTP API
import { OpenAI } from 'openai';
// Ollama will be accessed via HTTP API
import { AiConfig, AzureConfig, OllamaConfig } from '@shared/schema';

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
      const prompt = this.formatMessagesForOllama(messages, systemPrompt);
      
      const response = await fetch(`${this.config.endpoint}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          prompt: prompt,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.response || 'I apologize, but I could not generate a response at this time.';
    } catch (error) {
      console.error('Ollama AI Error:', error);
      throw new Error('Failed to generate response using Ollama');
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.endpoint}/api/tags`);
      return response.ok;
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
    let prompt = '';
    
    if (systemPrompt) {
      prompt += `System: ${systemPrompt}\n\n`;
    }
    
    messages.forEach(msg => {
      const role = msg.role === 'assistant' ? 'Assistant' : 'Human';
      prompt += `${role}: ${msg.content}\n\n`;
    });
    
    prompt += 'Assistant: ';
    return prompt;
  }
}

export class AIService {
  private provider: AIProvider | null = null;
  private config: AiConfig | null = null;

  setProvider(config: AiConfig) {
    this.config = config;
    
    if (config.provider === 'azure') {
      this.provider = new AzureAIProvider(config.config as AzureConfig & { deploymentName: string });
    } else if (config.provider === 'ollama') {
      this.provider = new OllamaAIProvider(config.config as OllamaConfig);
    }
  }

  async generateResponse(
    messages: { role: string; content: string }[], 
    contextInfo?: string
  ): Promise<string> {
    if (!this.provider) {
      throw new Error('AI provider not configured');
    }

    const systemPrompt = this.buildSystemPrompt(contextInfo);
    return this.provider.generateResponse(messages, systemPrompt);
  }

  async testConnection(): Promise<boolean> {
    return this.provider?.testConnection() || false;
  }

  private buildSystemPrompt(contextInfo?: string): string {
    let prompt = `You are a helpful customer service representative for an e-commerce store. Your role is to:

1. Assist customers with their inquiries in a friendly, professional manner
2. Help with order tracking, product recommendations, and general questions
3. Ask relevant follow-up questions to better understand customer needs
4. Provide accurate information based on the available data
5. If you don't know something, politely say so and offer to help find the information

Guidelines:
- Be conversational and empathetic
- Keep responses concise but helpful
- Always maintain a positive, solution-oriented tone
- Use the customer's name when appropriate
- Offer additional assistance at the end of your responses`;

    if (this.config?.customInstructions) {
      prompt += `\n\nAdditional Instructions:\n${this.config.customInstructions}`;
    }

    if (contextInfo) {
      prompt += `\n\nRelevant Information:\n${contextInfo}`;
    }

    return prompt;
  }

  async getOllamaModels(endpoint: string = 'http://localhost:11434'): Promise<string[]> {
    try {
      const response = await fetch(`${endpoint}/api/tags`);
      if (!response.ok) return [];
      
      const data = await response.json();
      return data.models?.map((model: any) => model.name) || [];
    } catch (error) {
      console.error('Failed to fetch Ollama models:', error);
      return [];
    }
  }
}

export const aiService = new AIService();