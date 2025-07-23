import { useState, useEffect, useRef } from "react";
import { Bot, User, AlertCircle, MessageCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export interface Message {
  id: string;
  content: string;
  isBot: boolean;
  timestamp: Date;
  sources?: Array<{ title: string; url?: string }>;
  confidence?: number;
}

interface ChatState {
  awaitingEmail: boolean;
  awaitingOrderId: boolean;
  email?: string;
  orderId?: string;
}

export default function Chatbot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [chatState, setChatState] = useState<ChatState>({
    awaitingEmail: false,
    awaitingOrderId: false
  });
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Check AI provider status
  const { data: systemStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['/api/status'],
    queryFn: () => apiRequest('/api/status'),
    refetchInterval: 10000 // Check every 10 seconds
  });

  const isAiConnected = systemStatus?.aiProvider?.configured && systemStatus?.aiProvider?.active;

  // Chat mutation
  const chatMutation = useMutation({
    mutationFn: (message: { content: string; sessionId: string; isBot: boolean }) => 
      apiRequest('/api/chat/message', {
        method: 'POST',
        body: JSON.stringify(message)
      }),
    onError: (error: any) => {
      toast({
        title: "Connection Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Order tracking mutation
  const trackOrderMutation = useMutation({
    mutationFn: (data: { email: string; orderId: string }) => 
      apiRequest('/api/track-order', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    onSuccess: (data) => {
      addBotMessage(`✅ Great! I found your order. Here are the details:

**Order ${data.order.orderNumber}**
Customer: ${data.order.customer.name}
Status: ${data.order.status}
Order Date: ${new Date(data.order.orderDate).toLocaleDateString()}

${data.latestUpdate ? `Latest Update: ${data.latestUpdate.status}` : ''}

Is there anything specific about this order you'd like to know more about?`);
      
      setChatState({ awaitingEmail: false, awaitingOrderId: false });
    },
    onError: (error: any) => {
      addBotMessage("❌ Sorry, I couldn't find an order with those details. Please double-check your email address and order ID. Would you like to try again or speak with a human agent?");
      setChatState({ awaitingEmail: false, awaitingOrderId: false });
    }
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize with greeting
  useEffect(() => {
    if (statusLoading) return;
    
    if (!isAiConnected) {
      addBotMessage("🤖 Hello! I'm your KarjiStore AI assistant, but I'm currently not fully configured. Please contact an administrator to set up the AI provider (Azure OpenAI or Ollama) before I can assist you with detailed inquiries. However, I can still help you track orders!");
    } else {
      addBotMessage("👋 Hello! I'm your KarjiStore AI assistant. I'm here to help you with order tracking, product questions, returns, and any other inquiries you might have. How can I assist you today?");
    }
  }, [isAiConnected, statusLoading]);

  const addBotMessage = (content: string, sources?: Array<{ title: string; url?: string }>, confidence?: number) => {
    const message: Message = {
      id: `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content,
      isBot: true,
      timestamp: new Date(),
      sources,
      confidence
    };
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

  const handleSendMessage = async () => {
    if (!input.trim()) return;
    
    const userMessage = input.trim();
    setInput("");
    addUserMessage(userMessage);

    // Handle order tracking flow
    if (chatState.awaitingEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRegex.test(userMessage)) {
        setChatState(prev => ({ ...prev, email: userMessage, awaitingEmail: false, awaitingOrderId: true }));
        addBotMessage("Great! Now please provide your order ID or order number.");
        return;
      } else {
        addBotMessage("That doesn't look like a valid email address. Please enter your email address in the format: example@email.com");
        return;
      }
    }

    if (chatState.awaitingOrderId) {
      setChatState(prev => ({ ...prev, orderId: userMessage, awaitingOrderId: false }));
      addBotMessage("Let me look up your order...");
      
      if (chatState.email) {
        trackOrderMutation.mutate({
          email: chatState.email,
          orderId: userMessage
        });
      }
      return;
    }

    // Check if user wants to track an order
    const lowerMessage = userMessage.toLowerCase();
    if (lowerMessage.includes('track') && (lowerMessage.includes('order') || lowerMessage.includes('package'))) {
      setChatState({ awaitingEmail: true, awaitingOrderId: false });
      addBotMessage("I'd be happy to help you track your order! Please provide your email address first.");
      return;
    }

    // For other queries, use AI if connected
    if (isAiConnected) {
      addBotMessage("Let me think about that...");
      
      chatMutation.mutate({
        content: userMessage,
        sessionId,
        isBot: false
      }, {
        onSuccess: (response) => {
          // Remove the "thinking" message
          setMessages(prev => prev.slice(0, -1));
          
          addBotMessage(
            response.message || "I'm sorry, I don't have a specific answer for that. Would you like me to connect you with a human agent?",
            response.sources,
            response.confidence
          );
        },
        onError: () => {
          // Remove the "thinking" message
          setMessages(prev => prev.slice(0, -1));
          addBotMessage("I'm experiencing some technical difficulties right now. Please try again in a moment, or let me know if you'd like to track an order - I can still help with that!");
        }
      });
    } else {
      // Without AI, provide basic responses
      if (lowerMessage.includes('return') || lowerMessage.includes('refund')) {
        addBotMessage("For returns and refunds, our policy is:\n\n• 30-day return window\n• Items must be unused and in original packaging\n• Free return shipping\n• Refunds processed within 5-7 business days\n\nWould you like me to connect you with our returns department?");
      } else if (lowerMessage.includes('shipping') || lowerMessage.includes('delivery')) {
        addBotMessage("Our shipping information:\n\n• Standard shipping: 3-5 business days\n• Express shipping: 1-2 business days\n• Free shipping on orders over $50\n\nFor specific delivery questions, please provide your order details or contact our shipping department.");
      } else if (lowerMessage.includes('help') || lowerMessage.includes('support')) {
        addBotMessage("I'm here to help! I can assist with:\n\n• Order tracking\n• Shipping information\n• Return policies\n• General questions\n\nWhat would you like to know more about?");
      } else {
        addBotMessage("I understand you're asking about that, but I need my AI capabilities to be fully configured to provide detailed answers. However, I can help you track orders or answer basic questions about shipping and returns. You can also contact our support team for immediate assistance.");
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const restartChat = () => {
    setMessages([]);
    setChatState({ awaitingEmail: false, awaitingOrderId: false });
    
    setTimeout(() => {
      if (!isAiConnected) {
        addBotMessage("🤖 Hello! I'm your KarjiStore AI assistant, but I'm currently not fully configured. Please contact an administrator to set up the AI provider (Azure OpenAI or Ollama) before I can assist you with detailed inquiries. However, I can still help you track orders!");
      } else {
        addBotMessage("👋 Hello! I'm your KarjiStore AI assistant. I'm here to help you with order tracking, product questions, returns, and any other inquiries you might have. How can I assist you today?");
      }
    }, 100);
  };

  const getPlaceholder = () => {
    if (!isAiConnected) {
      return "AI not configured - basic responses only...";
    }
    if (chatState.awaitingEmail) {
      return "Enter your email address...";
    }
    if (chatState.awaitingOrderId) {
      return "Enter your order ID...";
    }
    return "Type your message...";
  };

  return (
    <div className="w-full h-full flex flex-col bg-white">
      {/* Chat Header */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
            <MessageCircle className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-lg">KarjiStore Support</h1>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isAiConnected ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
              <p className="text-sm text-white text-opacity-80">
                {isAiConnected ? 'AI Assistant Online' : 'Basic Mode'}
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={restartChat}
          className="p-2 rounded-lg bg-white bg-opacity-20 hover:bg-opacity-30 transition-colors"
          title="Restart Chat"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* AI Status Warning */}
      {!isAiConnected && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3">
          <div className="flex items-center">
            <AlertCircle className="w-4 h-4 text-yellow-600 mr-2" />
            <span className="text-sm text-yellow-700">
              AI assistant not fully configured. Limited to basic responses and order tracking.
            </span>
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.isBot ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[80%] ${message.isBot ? 'bg-gray-100' : 'bg-blue-500 text-white'} rounded-lg p-3`}>
              <div className="flex items-start space-x-2">
                {message.isBot && <Bot className="w-4 h-4 mt-1 text-blue-600" />}
                {!message.isBot && <User className="w-4 h-4 mt-1" />}
                <div className="flex-1">
                  <div className="whitespace-pre-wrap">{message.content}</div>
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-2 text-xs opacity-75">
                      <div className="font-semibold">Sources:</div>
                      {message.sources.map((source, index) => (
                        <div key={index}>
                          {source.url ? (
                            <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline">
                              {source.title}
                            </a>
                          ) : (
                            source.title
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {message.confidence && (
                    <div className="mt-1 text-xs opacity-60">
                      Confidence: {Math.round(message.confidence * 100)}%
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <div className="border-t p-4">
        <div className="flex space-x-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={getPlaceholder()}
            disabled={chatMutation.isPending || trackOrderMutation.isPending}
            className="flex-1"
          />
          <Button 
            onClick={handleSendMessage}
            disabled={!input.trim() || chatMutation.isPending || trackOrderMutation.isPending}
          >
            {chatMutation.isPending || trackOrderMutation.isPending ? 'Sending...' : 'Send'}
          </Button>
        </div>
        
        {chatState.awaitingEmail && (
          <div className="mt-2 text-sm text-gray-600">
            Please enter the email address associated with your order.
          </div>
        )}
        
        {chatState.awaitingOrderId && (
          <div className="mt-2 text-sm text-gray-600">
            Please enter your order ID or order number.
          </div>
        )}
      </div>
    </div>
  );
}