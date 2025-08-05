import React, { useState, useEffect, useRef } from 'react';
import { Bot, User, Send, MessageCircle, X, Gift, Watch, Sparkles, Heart, RefreshCw, ExternalLink } from 'lucide-react';
import '../styles/KarjistoreChatBot.css';

// Types
interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  products?: Product[];
}

interface Product {
  title: string;
  description: string;
  price: number;
  imageUrl: string | null;
  productUrl: string;
}

interface QuickAction {
  label: string;
  value: string;
  icon: React.ComponentType<any>;
}

// Component Props
interface ChatBotLuxuryProps {
  /** Callback when a message is sent */
  onSendMessage?: (message: string) => Promise<string | { message: string; products?: Product[] }>;
  /** Custom quick actions */
  quickActions?: QuickAction[];
  /** Custom welcome message */
  welcomeMessage?: string;
  /** Custom placeholder text */
  placeholder?: string;
  /** Custom title */
  title?: string;
  /** Custom subtitle */
  subtitle?: string;
}

// Default quick actions
const defaultQuickActions: QuickAction[] = [
  { label: "Gift Sets", value: "Show me your gift sets", icon: Gift },
  { label: "Watches", value: "Show me your timepiece collection", icon: Watch },
  { label: "Perfumes", value: "What perfumes and fragrances do you have?", icon: Sparkles },
  { label: "Bath & Body", value: "Show me your bath and body products", icon: Heart },
];

// Default bot responses
const defaultBotResponses: { [key: string]: string } = {
  "Show me your gift sets": "Our luxury gift sets are perfect for special occasions. We offer curated collections featuring our finest fragrances, premium accessories, and elegant packaging that reflects the sophistication of the Karjistore brand.",
  "Show me your timepiece collection": "Discover our exquisite timepiece collection featuring Swiss craftsmanship and elegant designs. Each watch in our collection represents the perfect fusion of traditional horological expertise and contemporary luxury aesthetics.",
  "What perfumes and fragrances do you have?": "Our fragrance collection includes rare and exclusive scents from the world's most prestigious perfume houses. From fresh citrus notes to deep, mysterious compositions, each fragrance tells a unique story of luxury and elegance.",
  "Show me your bath and body products": "Indulge in our luxurious bath and body collection featuring premium ingredients and sophisticated scents. Our range includes moisturizing lotions, exfoliating scrubs, and aromatic bath oils for the ultimate spa experience at home."
};

const ChatBotLuxury: React.FC<ChatBotLuxuryProps> = ({
  onSendMessage,
  quickActions = defaultQuickActions,
  welcomeMessage = "Welcome to your personal luxury shopping experience at Karjistore. I'm your dedicated concierge, ready to help you discover our finest collections of fragrances, timepieces, and accessories.",
  placeholder = "Share your luxury preferences...",
  title = "Luxury Concierge",
  subtitle = "Personal Assistant Available"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Generate unique ID for messages
  const generateId = () => Math.random().toString(36).substr(2, 9);

  // Reset chat function
  const resetChat = () => {
    setMessages([]);
    setMessage('');
    setIsTyping(false);
  };

  // Handle sending messages
  const handleSendMessage = async () => {
    if (!message.trim()) return;

    const userMessage: Message = {
      id: generateId(),
      content: message.trim(),
      role: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setMessage('');
    setIsTyping(true);

    try {
      // Use custom handler or default responses
      const response = onSendMessage 
        ? await onSendMessage(userMessage.content)
        : defaultBotResponses[userMessage.content] || "Thank you for your message. Our luxury concierge is here to assist you with any questions about our premium collections.";

      // Simulate typing delay
      setTimeout(() => {
        const botMessage: Message = {
          id: generateId(),
          content: typeof response === 'string' ? response : response.message,
          role: 'assistant',
          timestamp: new Date(),
          products: typeof response === 'object' && response.products ? response.products : undefined
        };

        setMessages(prev => [...prev, botMessage]);
        setIsTyping(false);
      }, 1500);
    } catch (error) {
      console.error('Error sending message:', error);
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleQuickAction = (actionValue: string) => {
    setMessage(actionValue);
    setTimeout(() => handleSendMessage(), 100);
  };

  // Function to render product cards
  const renderProductCards = (products: Product[]) => {
    return (
      <div className="mt-3 space-y-1.5 w-full">
        {products.map((product, index) => (
          <div 
            key={index}
            className="bg-white border border-gray-100 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 group cursor-pointer w-full"
            onClick={() => window.open(product.productUrl, '_blank')}
          >
            <div className="flex items-center p-0">
              {/* Product image with gradient overlay */}
              <div className="w-14 h-14 bg-gradient-to-br from-amber-50 to-gray-50 flex-shrink-0 flex items-center justify-center relative overflow-hidden">
                {product.imageUrl ? (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-50/10 to-amber-100/20 z-10"></div>
                    <img 
                      src={product.imageUrl} 
                      alt={product.title}
                      className="w-full h-full object-contain transition-transform group-hover:scale-105 z-0"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-amber-200">
                    <Gift className="h-6 w-6" />
                  </div>
                )}
              </div>
              
              {/* Product info with refined styling */}
              <div className="flex-1 py-1.5 px-2 flex flex-col min-w-0 max-w-full overflow-hidden">
                <h3 className="font-medium text-xs text-gray-600 truncate group-hover:text-gray-800 transition-colors">{product.title}</h3>
                
                <div className="text-xs text-gray-400 max-w-full">
                  <p className="line-clamp-1 text-[10px]">{product.description || 'No description available'}</p>
                </div>
                
                <div className="flex items-center justify-between mt-1">
                  <div className="font-semibold text-xs" style={{ color: '#d4af37' }}>{product.price.toFixed(2)} AED</div>
                  
                  <button
                    className="inline-flex items-center justify-center w-6 h-6 text-white rounded-full transition-all hover:scale-105"
                    style={{ background: 'linear-gradient(to right, #d4af37, #b8941f)' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(product.productUrl, '_blank');
                    }}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-br from-amber-600 via-yellow-600 to-amber-700 hover:from-amber-500 hover:via-yellow-500 hover:to-amber-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 z-50 flex items-center justify-center"
          aria-label="Open chat"
        >
          <MessageCircle className="h-7 w-7" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="karjistore-chat fixed bottom-6 right-6 w-96 h-[600px] bg-white rounded-3xl shadow-2xl border border-gray-200 flex flex-col z-50 overflow-hidden">
          {/* Header */}
          <div className="bg-white p-5 rounded-t-3xl relative overflow-hidden border-b border-gray-100/80">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-50/30 via-yellow-50/20 to-amber-50/10"></div>
            <div className="relative flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-600 via-yellow-600 to-amber-700 rounded-full flex items-center justify-center shadow-lg">
                  <Bot className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{title}</h3>
                  <div className="flex items-center space-x-2 text-xs text-gray-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-lg"></div>
                    <span>{subtitle}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-1">
                <button
                  onClick={resetChat}
                  className="text-gray-500 hover:text-amber-600 hover:bg-amber-50 h-8 w-8 rounded-full transition-colors flex items-center justify-center"
                  aria-label="Reset chat"
                  title="Reset conversation"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-500 hover:text-gray-700 hover:bg-gray-100/50 h-8 w-8 rounded-full transition-colors flex items-center justify-center"
                  aria-label="Close chat"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto bg-white">
            {/* Welcome Message */}
            {messages.length === 0 && (
              <div className="mb-5">
                <div className="flex items-start space-x-3 max-w-[85%]">
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-600 via-yellow-600 to-amber-700 rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
                    <Bot className="h-5 w-5 text-white" />
                  </div>
                  <div className="bg-gray-50 rounded-2xl rounded-tl-sm p-4 shadow-sm border border-gray-100 break-words">
                    <p className="text-sm leading-relaxed">
                      {welcomeMessage}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Message List */}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`mb-5 ${msg.role === "user" ? "flex justify-end" : ""}`}
              >
                {msg.role === "user" ? (
                  <div className="flex items-start space-x-3 justify-end max-w-[85%]">
                    <div className="bg-amber-50 text-gray-800 rounded-2xl rounded-tr-sm p-4 shadow-sm border border-amber-100 break-words">
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                    </div>
                    <div className="w-10 h-10 bg-gradient-to-br from-gray-400 via-gray-500 to-gray-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
                      <User className="h-5 w-5 text-white" />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start space-x-3 max-w-[85%]">
                    <div className="w-10 h-10 bg-gradient-to-br from-amber-600 via-yellow-600 to-amber-700 rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
                      <Bot className="h-5 w-5 text-white" />
                    </div>
                    <div className="bg-gray-50 rounded-2xl rounded-tl-sm p-4 shadow-sm border border-gray-100 break-words max-w-full">
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                      
                      {/* Product Cards */}
                      {msg.products && msg.products.length > 0 && renderProductCards(msg.products)}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="mb-5">
                <div className="flex items-start space-x-3 max-w-[85%]">
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-600 via-yellow-600 to-amber-700 rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
                    <Bot className="h-5 w-5 text-white" />
                  </div>
                  <div className="bg-gray-50 rounded-2xl rounded-tl-sm p-3 shadow-sm border border-gray-100">
                    <div className="flex space-x-1.5">
                      <div className="w-2 h-2 bg-amber-600 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-amber-600 rounded-full animate-bounce delay-100"></div>
                      <div className="w-2 h-2 bg-amber-600 rounded-full animate-bounce delay-200"></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-white rounded-b-3xl border-t border-gray-100">
            <div className="flex items-center space-x-2 mb-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder={placeholder}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-xs text-gray-800 focus:ring-2 focus:ring-amber-400 focus:border-amber-400 shadow-sm outline-none transition-colors"
                />
              </div>
              <button
                onClick={handleSendMessage}
                disabled={!message.trim()}
                className="bg-gradient-to-br from-amber-600 via-yellow-600 to-amber-700 hover:from-amber-500 hover:via-yellow-500 hover:to-amber-600 disabled:from-gray-300 disabled:via-gray-300 disabled:to-gray-300 text-white w-9 h-9 rounded-lg p-0 transition-all duration-300 hover:scale-105 shadow-md disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-2">
              {quickActions.map((action) => {
                const IconComponent = action.icon;
                return (
                  <button
                    key={action.label}
                    onClick={() => handleQuickAction(action.value)}
                    className="bg-gray-50 hover:bg-amber-50 text-gray-800 text-xs rounded-lg border border-gray-200 hover:border-amber-200 transition-all duration-200 font-medium h-8 overflow-hidden"
                  >
                    <div className="flex items-center justify-center w-full h-full px-2">
                      <IconComponent className="h-3 w-3 text-amber-600 flex-shrink-0 mr-1" />
                      <span className="truncate text-xs">{action.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatBotLuxury;
export type { ChatBotLuxuryProps, Message, QuickAction, Product }; 