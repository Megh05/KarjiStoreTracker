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
    <div className="w-full h-full flex flex-col bg-white">
      {/* Chat Header */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
            <MessageCircle className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-lg">KarjiStore Support</h1>
            <p className="text-sm text-white text-opacity-80">Online • Instant replies</p>
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

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
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
