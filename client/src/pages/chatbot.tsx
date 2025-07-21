import { useState, useEffect, useRef } from "react";
import { Bot, User, Package, MessageCircle, RotateCcw, Settings, RefreshCw } from "lucide-react";
import ChatMessage from "@/components/chat-message";
import OrderTrackingModal from "@/components/order-tracking-modal";
import ChatInput from "@/components/chat-input";

export interface Message {
  id: string;
  content: string;
  isBot: boolean;
  timestamp: Date;
  type?: 'text' | 'options' | 'form' | 'order-result';
  options?: Array<{
    label: string;
    value: string;
    icon?: string;
  }>;
  orderData?: OrderTrackingData;
}

export interface OrderTrackingData {
  order: {
    id: number;
    orderNumber: string;
    orderDate: string;
    status: string;
    customer: {
      name: string;
      email: string;
    };
  };
  timeline: Array<{
    id: number;
    status: string;
    date: string | null;
    completed: boolean;
    isLatest: boolean;
  }>;
  latestUpdate: {
    status: string;
    date: string;
  } | null;
}

export default function Chatbot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [orderData, setOrderData] = useState<OrderTrackingData | null>(null);
  const [currentFlow, setCurrentFlow] = useState<string | null>(null);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize with welcome message
  useEffect(() => {
    const welcomeMessage: Message = {
      id: "welcome",
      content: "👋 Welcome to KarjiStore! I'm here to help you with:",
      isBot: true,
      timestamp: new Date(),
      type: 'options',
      options: [
        { label: "📦 Track my order", value: "track", icon: "📦" },
        { label: "💬 General inquiry", value: "general", icon: "💬" },
        { label: "🔄 Returns & refunds", value: "return", icon: "🔄" },
        { label: "🛠️ Technical support", value: "support", icon: "🛠️" }
      ]
    };
    setMessages([welcomeMessage]);
  }, []);

  const addMessage = (content: string, isBot = true, type: 'text' | 'options' | 'form' | 'order-result' = 'text', options?: Message['options'], orderData?: OrderTrackingData) => {
    const newMessage: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content,
      isBot,
      timestamp: new Date(),
      type,
      options,
      orderData
    };
    setMessages(prev => [...prev, newMessage]);
    return newMessage.id;
  };

  const restartChat = () => {
    setMessages([]);
    setCurrentFlow(null);
    setOrderData(null);
    setIsModalOpen(false);
    
    // Re-initialize with welcome message
    setTimeout(() => {
      const welcomeMessage: Message = {
        id: "welcome",
        content: "👋 Welcome to KarjiStore! I'm here to help you with:",
        isBot: true,
        timestamp: new Date(),
        type: 'options',
        options: [
          { label: "📦 Track my order", value: "track", icon: "📦" },
          { label: "💬 General inquiry", value: "general", icon: "💬" },
          { label: "🔄 Returns & refunds", value: "return", icon: "🔄" },
          { label: "🛠️ Technical support", value: "support", icon: "🛠️" }
        ]
      };
      setMessages([welcomeMessage]);
    }, 100);
  };

  const addTypingMessage = () => {
    return addMessage("typing", true);
  };

  const removeMessage = (messageId: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== messageId));
  };

  const handleOptionSelect = (option: string) => {
    const optionLabels: Record<string, string> = {
      'track': '📦 Track my order',
      'general': '💬 General inquiry', 
      'return': '🔄 Returns & refunds',
      'support': '🛠️ Technical support',
      'order-not-found': ''  // No user message for this
    };

    // Add user's selection as a message (except for order-not-found)
    if (option !== 'order-not-found') {
      addMessage(optionLabels[option], false);
    }

    // Show typing indicator
    const typingId = addTypingMessage();
    
    setTimeout(() => {
      removeMessage(typingId);
      setCurrentFlow(option);
      
      switch(option) {
        case 'track':
          addMessage(
            `Great! I'll help you track your order. Please provide your email address and order ID.`,
            true,
            'form'
          );
          break;
        case 'order-not-found':
          addMessage(
            "❌ Sorry, I couldn't find an order with those details. Please check:\n\n• Your email address is correct\n• Your order ID or order number is correct\n\nWould you like to try tracking your order again?", 
            true, 
            'options', 
            [
              { label: "🔄 Try again", value: "track" },
              { label: "📞 Contact support", value: "support" }
            ]
          );
          break;
        case 'general':
          addMessage("I'm here to help with any questions you have about KarjiStore! What would you like to know?");
          break;
        case 'return':
          addMessage(`I can help you with returns and refunds. Here's what you need to know:

• 30-day return policy
• Free return shipping  
• Refund within 5-7 business days

Would you like to start a return request?`);
          break;
        case 'support':
          addMessage("I'm ready to help with any technical issues you're experiencing. Please describe the problem you're facing.");
          break;
      }
    }, 1000);
  };

  const handleOrderTracking = (trackingData: OrderTrackingData) => {
    setOrderData(trackingData);
    
    addMessage(
      `✅ Order found! Here are your order details:

**Order ${trackingData.order.orderNumber}**
Customer: ${trackingData.order.customer.name}
Status: ${trackingData.order.status}
Order Date: ${new Date(trackingData.order.orderDate).toLocaleDateString()}`,
      true,
      'order-result',
      undefined,
      trackingData
    );
  };

  const handleSendMessage = (content: string) => {
    addMessage(content, false);
    
    const typingId = addTypingMessage();
    
    setTimeout(() => {
      removeMessage(typingId);
      
      if (currentFlow === 'general') {
        addMessage("Thanks for your message! I've received it and our team will help you shortly. Is there anything else you'd like to know?");
      } else if (currentFlow === 'return') {
        addMessage("I've noted your return request. Our customer service team will review your request and contact you within 24 hours with next steps.");
      } else if (currentFlow === 'support') {
        addMessage("Thank you for describing the technical issue. I've forwarded this to our technical support team. They will reach out to you shortly with a solution.");
      } else {
        addMessage("Thank you for your message. How else can I help you today?");
      }
    }, 1000);
  };



  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-neutral-50">
      {/* Mobile Header */}
      <div className="bg-white shadow-sm border-b border-neutral-100 p-4 lg:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
              <Bot className="text-white w-5 h-5" />
            </div>
            <div>
              <h1 className="font-semibold text-neutral-800">KarjiStore Support</h1>
              <p className="text-sm text-neutral-500">Online • Instant replies</p>
            </div>
          </div>
          <button
            onClick={restartChat}
            className="p-2 text-neutral-400 hover:text-neutral-600 transition-colors"
            title="Restart Chat"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:block w-80 bg-white shadow-lg border-r border-neutral-100">
        <div className="p-6 border-b border-neutral-100">
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
              <Bot className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-neutral-800">KarjiStore</h1>
              <p className="text-neutral-500">Customer Support Bot</p>
            </div>
          </div>
          <div className="bg-neutral-50 rounded-lg p-4">
            <div className="flex items-center space-x-2 text-sm text-neutral-600">
              <div className="w-2 h-2 bg-secondary rounded-full"></div>
              <span>Online • Instant replies</span>
            </div>
          </div>
        </div>
        
        {/* Quick Actions */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-neutral-800">Quick Actions</h3>
            <button
              onClick={restartChat}
              className="p-2 text-neutral-400 hover:text-neutral-600 transition-colors"
              title="Restart Chat"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            <button 
              onClick={() => handleOptionSelect('track')}
              className="w-full text-left p-3 rounded-lg bg-neutral-50 hover:bg-neutral-100 transition-colors flex items-center space-x-3"
            >
              <Package className="text-primary w-4 h-4" />
              <span className="text-sm font-medium">Track Order</span>
            </button>
            <button 
              onClick={() => handleOptionSelect('general')}
              className="w-full text-left p-3 rounded-lg bg-neutral-50 hover:bg-neutral-100 transition-colors flex items-center space-x-3"
            >
              <MessageCircle className="text-primary w-4 h-4" />
              <span className="text-sm font-medium">General Inquiry</span>
            </button>
            <button 
              onClick={() => handleOptionSelect('return')}
              className="w-full text-left p-3 rounded-lg bg-neutral-50 hover:bg-neutral-100 transition-colors flex items-center space-x-3"
            >
              <RotateCcw className="text-primary w-4 h-4" />
              <span className="text-sm font-medium">Returns & Refunds</span>
            </button>
            <button 
              onClick={() => handleOptionSelect('support')}
              className="w-full text-left p-3 rounded-lg bg-neutral-50 hover:bg-neutral-100 transition-colors flex items-center space-x-3"
            >
              <Settings className="text-primary w-4 h-4" />
              <span className="text-sm font-medium">Technical Support</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[calc(100vh-120px)] lg:max-h-[calc(100vh-80px)]">
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              onOptionSelect={handleOptionSelect}
              onOrderTracking={handleOrderTracking}
              sessionId={sessionId}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input */}
        <ChatInput
          onSendMessage={handleSendMessage}
          disabled={currentFlow === null}
          placeholder={
            currentFlow === null 
              ? "Please select an option above to get started..."
              : currentFlow === 'track'
              ? "Use the form above to track your order"
              : "Type your message..."
          }
        />
      </div>

      {/* Order Tracking Modal */}
      {orderData && (
        <OrderTrackingModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          orderData={orderData}
        />
      )}
    </div>
  );
}
