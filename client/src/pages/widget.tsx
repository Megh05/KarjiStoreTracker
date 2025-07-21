import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send, Package } from "lucide-react";

interface Message {
  id: string;
  content: string;
  isBot: boolean;
  timestamp: Date;
  showOrderForm?: boolean;
  orderResult?: any;
}

interface OrderForm {
  email: string;
  orderId: string;
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [orderForm, setOrderForm] = useState<OrderForm>({ email: "", orderId: "" });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize chat when opened
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMessage: Message = {
        id: "welcome",
        content: "Hi! I can help you track your KarjiStore order. Would you like to track an order?",
        isBot: true,
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
    }
  }, [isOpen]);

  const addMessage = (content: string, isBot: boolean, options: any = {}) => {
    const message: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content,
      isBot,
      timestamp: new Date(),
      ...options
    };
    setMessages(prev => [...prev, message]);
  };

  const handleSendMessage = (text: string) => {
    if (!text.trim()) return;

    // Add user message
    addMessage(text, false);
    setInputValue("");

    // Simple keyword detection for order tracking
    const lowerText = text.toLowerCase();
    if (lowerText.includes("track") || lowerText.includes("order") || lowerText.includes("status")) {
      setShowOrderForm(true);
      addMessage("I'll help you track your order. Please provide your email and order ID:", true, { showOrderForm: true });
    } else if (lowerText.includes("yes") || lowerText.includes("sure")) {
      setShowOrderForm(true);
      addMessage("Great! Please provide your email and order ID:", true, { showOrderForm: true });
    } else {
      // Generic response
      setTimeout(() => {
        addMessage("Thanks for your message! I'm designed to help with order tracking. Would you like to track an order?", true);
      }, 500);
    }
  };

  const handleOrderSubmit = async () => {
    if (!orderForm.email || !orderForm.orderId) return;

    setIsLoading(true);
    setShowOrderForm(false);

    try {
      const response = await fetch("/api/track-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderForm),
      });

      const data = await response.json();

      if (response.ok) {
        const orderInfo = `✅ **Order Found!**\n\n📦 Order: ${data.order.orderNumber}\n👤 Customer: ${data.order.customer.name}\n📅 Date: ${new Date(data.order.orderDate).toLocaleDateString()}\n🏷️ Status: ${data.order.status}\n\n**Recent Updates:**\n${data.timeline.slice(0, 3).map((item: any, index: number) => 
          `${index + 1}. ${item.status} (${new Date(item.date).toLocaleDateString()})`
        ).join('\n')}`;
        
        addMessage(orderInfo, true, { orderResult: data });
        addMessage("Is there anything else I can help you with?", true);
      } else {
        addMessage("❌ " + data.message, true);
        addMessage("Would you like to try again with different details?", true);
      }
    } catch (error) {
      addMessage("Sorry, I couldn't check your order right now. Please try again later.", true);
    }

    setIsLoading(false);
    setOrderForm({ email: "", orderId: "" });
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-full w-14 h-14 shadow-lg flex items-center justify-center transition-all hover:scale-105"
        >
          <MessageCircle size={24} />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="bg-white rounded-lg shadow-2xl w-80 h-96 flex flex-col border border-gray-200">
          {/* Header */}
          <div className="bg-blue-600 text-white p-4 rounded-t-lg flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Package size={20} />
              <span className="font-medium">KarjiStore Support</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="hover:bg-blue-700 rounded-full p-1 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isBot ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                    message.isBot
                      ? "bg-gray-100 text-gray-800"
                      : "bg-blue-600 text-white"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{message.content}</div>
                </div>
              </div>
            ))}

            {/* Order Form */}
            {showOrderForm && (
              <div className="bg-gray-50 p-3 rounded-lg space-y-3">
                <input
                  type="email"
                  placeholder="Your email"
                  value={orderForm.email}
                  onChange={(e) => setOrderForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full p-2 border rounded text-sm"
                />
                <input
                  type="text"
                  placeholder="Order ID (e.g., ORD-2024-001)"
                  value={orderForm.orderId}
                  onChange={(e) => setOrderForm(prev => ({ ...prev, orderId: e.target.value }))}
                  className="w-full p-2 border rounded text-sm"
                />
                <button
                  onClick={handleOrderSubmit}
                  disabled={isLoading || !orderForm.email || !orderForm.orderId}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-2 rounded text-sm transition-colors"
                >
                  {isLoading ? "Checking..." : "Track Order"}
                </button>
              </div>
            )}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-800 px-3 py-2 rounded-lg text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t p-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSendMessage(inputValue)}
                placeholder="Type your message..."
                className="flex-1 p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => handleSendMessage(inputValue)}
                disabled={!inputValue.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-3 py-2 rounded-lg transition-colors"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}