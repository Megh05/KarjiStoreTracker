import React, { useState, useEffect, useRef } from 'react';
import { sendAgentMessage, getAgentChatHistory } from '@/lib/chat-api';
import ChatInput from './chat-input';
import ChatMessage from './chat-message';
import { useToast } from '@/hooks/use-toast';

export interface Message {
  id: string;
  content: string;
  isBot: boolean;
  timestamp: Date;
  sources?: Array<{ title: string; url?: string }>;
  confidence?: number;
  type?: 'text' | 'options' | 'form' | 'order-result' | 'typing' | 'product-recommendations';
  options?: Array<{ label: string; value: string }>;
  orderData?: any;
  products?: Array<{
    title: string;
    description: string;
    price: number;
    imageUrl: string | null;
    productUrl: string;
  }>;
}

const AgentChatWidget: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Initialize session ID and load chat history
  useEffect(() => {
    // Get or create session ID
    let id = localStorage.getItem('chatSessionId');
    if (!id) {
      id = `agent_session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('chatSessionId', id);
    }
    setSessionId(id);

    // Load chat history
    const loadHistory = async () => {
      try {
        const history = await getAgentChatHistory(id!);
        if (Array.isArray(history) && history.length > 0) {
          const formattedHistory = history.map((msg: any) => ({
            id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            content: msg.content,
            isBot: msg.isBot,
            timestamp: new Date(msg.timestamp),
            type: msg.type || 'text',
            products: msg.products || []
          }));
          setMessages(formattedHistory);
        } else {
          // Add welcome message if no history
          addBotMessage(
            "Hello! I'm your intelligent shopping assistant. How can I help you today?",
            [],
            1.0
          );
        }
      } catch (error) {
        console.error('Error loading chat history:', error);
        addBotMessage(
          "Hello! I'm your intelligent shopping assistant. How can I help you today?",
          [],
          1.0
        );
      }
    };

    loadHistory();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const addBotMessage = (
    content: string,
    sources?: Array<{ title: string; url?: string }>,
    confidence?: number,
    products?: any[]
  ) => {
    console.log("Adding bot message with products:", products);
    
    // Always set type to product-recommendations if products are provided
    // even if the array is empty - this ensures the component knows to expect products
    const messageType = products !== undefined ? 'product-recommendations' : 'text';
    
    const message: Message = {
      id: `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content,
      isBot: true,
      timestamp: new Date(),
      sources,
      confidence,
      type: messageType,
      products: products || [] // Ensure products is always an array
    };
    
    console.log("Created message with type:", messageType);
    setMessages(prev => [...prev, message]);
  };

  const addUserMessage = (content: string) => {
    const message: Message = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content,
      isBot: false,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, message]);
  };

  const addTypingIndicator = () => {
    const typingMessage: Message = {
      id: `typing_${Date.now()}`,
      content: 'Thinking...',
      isBot: true,
      timestamp: new Date(),
      type: 'typing'
    };
    setMessages(prev => [...prev, typingMessage]);
  };

  const removeTypingIndicator = () => {
    setMessages(prev => prev.filter(msg => msg.type !== 'typing'));
  };

  const handleSendMessage = async (message: string) => {
    if (!message.trim()) return;

    // Add user message
    addUserMessage(message);

    // Add typing indicator
    addTypingIndicator();

    // Set loading state
    setIsLoading(true);

    try {
      // Send message to agent API
      const response = await sendAgentMessage({
        content: message,
        sessionId
      });

      // Remove typing indicator
      removeTypingIndicator();

      // Add bot response
      // Debug products
      console.log("Response from agent:", response);
      console.log("Products received:", response.products ? response.products.length : 0, response.products);
      
      addBotMessage(
        response.message || "I'm here to help! How can I assist you?",
        response.sources,
        response.confidence,
        response.products
      );
    } catch (error) {
      console.error('Error sending message:', error);
      removeTypingIndicator();
      
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive'
      });
      
      addBotMessage('Sorry, I encountered an error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] max-h-[80vh] bg-white rounded-lg shadow-lg">
      <div className="p-4 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-t-lg">
        <h2 className="text-xl font-bold text-white">Karji AI Assistant</h2>
        <p className="text-sm text-white opacity-90">Powered by intelligent agent technology</p>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(message => (
          <ChatMessage 
            key={message.id} 
            message={message} 
            sessionId={sessionId}
            onOptionSelect={() => {}}
            onOrderTracking={() => {}}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="p-4 border-t">
        <ChatInput onSendMessage={handleSendMessage} disabled={isLoading} />
      </div>
    </div>
  );
};

export default AgentChatWidget;