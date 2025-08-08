import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { Bot, User, AlertCircle, MessageCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getChatHistory } from "@/lib/chat-api";
import ChatMessage from "@/components/chat-message";

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

interface ChatState {
  awaitingEmail: boolean;
  awaitingOrderId: boolean;
  awaitingProductPreference?: boolean;
  productPreferenceStep?: 'category' | 'budget' | 'features' | 'sort';
  email?: string;
  orderId?: string;
  productPreferences?: {
    category?: string;
    budget?: string;
    features?: string[];
    sort?: 'price_low' | 'price_high' | 'popularity';
    searchQuery?: string; // Added for custom search
  };
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
    }
  };
  timeline: Array<{
    id: number;
    status: string;
    date: string;
    completed: boolean;
    isLatest: boolean;
  }>;
  latestUpdate: {
    status: string;
    date: string;
  } | null;
}

interface ChatbotProps {
  isWidget?: boolean;
  theme?: 'default' | 'elegant' | 'luxury' | 'monochrome';
}

export interface ChatbotRef {
  restartChat: () => void;
}

// Add this function at the top of the file, outside the component
const getStoredMessages = (sessionId: string): Message[] => {
  try {
    const storedMessages = localStorage.getItem(`chatMessages_${sessionId}`);
    if (storedMessages) {
      const parsedMessages = JSON.parse(storedMessages);
      return parsedMessages.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));
    }
  } catch (error) {
    console.error("Failed to retrieve stored messages:", error);
  }
  return [];
};

// Add this function at the top of the file, outside the component
const storeMessages = (sessionId: string, messages: Message[]) => {
  try {
    localStorage.setItem(`chatMessages_${sessionId}`, JSON.stringify(messages));
  } catch (error) {
    console.error("Failed to store messages:", error);
  }
};

// Use localStorage to persist sessionId across page refreshes
const getSessionId = () => {
  let sessionId = localStorage.getItem('chatSessionId');
  if (!sessionId) {
    // Use a more stable sessionId generation
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substr(2, 9);
    sessionId = `session_${timestamp}_${randomId}`;
    localStorage.setItem('chatSessionId', sessionId);
    console.log('Generated new sessionId:', sessionId);
  } else {
    console.log('Using existing sessionId:', sessionId);
  }
  return sessionId;
};

// Add a function to get the current sessionId without generating a new one
const getCurrentSessionId = () => {
  const sessionId = localStorage.getItem('chatSessionId');
  console.log('Current sessionId from localStorage:', sessionId);
  return sessionId;
};

// Add a function to update session ID from backend response
const updateSessionId = (newSessionId: string) => {
  if (newSessionId && newSessionId !== getCurrentSessionId()) {
    console.log('Updating session ID:', {
      old: getCurrentSessionId(),
      new: newSessionId
    });
    localStorage.setItem('chatSessionId', newSessionId);
    return true;
  }
  return false;
};

const Chatbot = forwardRef<ChatbotRef, ChatbotProps>(({ isWidget = false, theme = 'default' }, ref) => {
  const [sessionId] = useState(() => {
    const id = getSessionId();
    console.log('Chatbot component initialized with sessionId:', id);
    return id;
  });
  const [messages, setMessages] = useState<Message[]>(() => getStoredMessages(sessionId));
  const [input, setInput] = useState("");
  const [chatState, setChatState] = useState<ChatState>({
    awaitingEmail: false,
    awaitingOrderId: false,
    awaitingProductPreference: false
  });
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Add a new state variable to track if we're in order tracking flow
  const [isInOrderTrackingFlow, setIsInOrderTrackingFlow] = useState(false);

  // Store messages in localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      storeMessages(sessionId, messages);
    }
  }, [messages, sessionId]);

  // Determine theme colors
  const isElegant = theme === 'elegant';
  const isLuxury = theme === 'luxury';
  const isMonochrome = theme === 'monochrome';

  // Theme styles
  const themeStyles = {
    container: isMonochrome ? 'bg-white' : 
               isLuxury ? 'bg-[#1a1a1a]' : 
               isElegant ? 'bg-black' : 'bg-white',
    botMessage: isMonochrome ? 'bg-gray-100 text-gray-900 border border-gray-200' : 
                isLuxury ? 'bg-[#2a2a2a] text-gray-100 border border-[#8a1538]/20' : 
                isElegant ? 'bg-zinc-900 text-amber-100 border border-amber-700/30' : 'bg-gray-100',
    userMessage: isMonochrome ? 'bg-black text-white' : 
                 isLuxury ? 'bg-[#8a1538] text-white' : 
                 isElegant ? 'bg-amber-900 text-amber-50' : 'bg-blue-500 text-white',
    botIcon: isMonochrome ? 'text-[#d4af37]' : 
             isLuxury ? 'text-[#e9c46a]' : 
             isElegant ? 'text-amber-400' : 'text-blue-600',
    input: isMonochrome ? 'bg-white text-gray-900 border-gray-200 focus:border-[#d4af37] placeholder:text-gray-400' : 
           isLuxury ? 'bg-[#2a2a2a] text-gray-100 border-[#8a1538]/30 focus:border-[#8a1538] placeholder:text-gray-500' : 
           isElegant ? 'bg-zinc-800 text-amber-100 border-amber-700/30 focus:border-amber-500 placeholder:text-amber-500/50' : '',
    button: isMonochrome ? 'bg-black hover:bg-gray-800 text-white' : 
            isLuxury ? 'bg-[#8a1538] hover:bg-[#6a1129] text-white' : 
            isElegant ? 'bg-amber-700 hover:bg-amber-800 text-amber-50' : '',
    typingDot: isMonochrome ? 'bg-[#d4af37]' : 
               isLuxury ? 'bg-[#e9c46a]' : 
               isElegant ? 'bg-amber-400' : 'bg-blue-400',
    borderColor: isMonochrome ? 'border-gray-200' : 
                 isLuxury ? 'border-[#8a1538]/30' : 
                 isElegant ? 'border-amber-700/30' : '',
    textColor: isMonochrome ? 'text-gray-500' : 
               isLuxury ? 'text-[#e9c46a]/70' : 
               isElegant ? 'text-amber-300/70' : 'text-gray-600'
  };

  // Expose the restartChat method to parent components
  useImperativeHandle(ref, () => ({
    restartChat: () => {
      restartChat();
    }
  }));

  // Check AI provider status
  const { data: systemStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['/api/status'],
    queryFn: () => apiRequest('/api/status'),
    refetchInterval: 10000 // Check every 10 seconds
  });

  const isAiConnected = systemStatus?.aiProvider?.configured && systemStatus?.aiProvider?.active;

  // Load chat history
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const history = await getChatHistory(sessionId);
        
        if (history && history.length > 0) {
          // Convert the history to Message objects
          const formattedMessages = history.map((msg: any) => ({
            id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            content: msg.content,
            isBot: msg.isBot,
            timestamp: new Date(msg.timestamp),
            type: 'text'
          }));
          
          setMessages(formattedMessages);
          setHistoryLoaded(true);
        } else {
          setHistoryLoaded(true);
        }
      } catch (error) {
        console.error("Failed to load chat history:", error);
        setHistoryLoaded(true);
      }
    };
    
    loadHistory();
  }, [sessionId]);

  // Chat mutation
  const chatMutation = useMutation({
    mutationFn: (message: { content: string; sessionId: string; isBot: boolean }) => 
      apiRequest('/api/chat/message', {
        method: 'POST',
        body: JSON.stringify(message)
      }),
    onError: (error: any) => {
      // Remove typing indicator
      setMessages(prev => prev.filter(msg => msg.type !== 'typing'));
      
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
      // Create an order result message with structured data and options
      const orderResultMessage: Message = {
        id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content: `✅ Order Found: ${data.order.orderNumber}`,
        isBot: true,
        timestamp: new Date(),
        type: 'order-result',
        orderData: data
      };
      
      setMessages(prev => [...prev, orderResultMessage]);
      
      // Add options for next steps
      const optionsMessage: Message = {
        id: `options_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content: "What would you like to do next?",
        isBot: true,
        timestamp: new Date(),
        type: 'options',
        options: [
          { label: "Track another order", value: "track-order" },
          { label: "Browse products", value: "product-recommendations" },
          { label: "Contact support", value: "contact-support" }
        ]
      };
      
      setMessages(prev => [...prev, optionsMessage]);
      
      setChatState({ awaitingEmail: false, awaitingOrderId: false });
      setIsInOrderTrackingFlow(false); // Clear the flag after successful order tracking
    },
    onError: (error: any) => {
      addBotMessage("❌ Sorry, I couldn't find an order with those details. Please double-check your email address and order ID. Would you like to try again or speak with a human agent?");
      setChatState({ awaitingEmail: false, awaitingOrderId: false });
      setIsInOrderTrackingFlow(false); // Clear the flag on error
    }
  });

  // Update the product recommendation mutation
  const productRecommendationMutation = useMutation({
    mutationFn: async (data: { preferences: any; sessionId: string }) => {
      try {
        const response = await apiRequest("/api/product-recommendations", {
          method: 'POST',
          body: JSON.stringify(data)
        });
        console.log("Product recommendation API response:", response);
        return response; // apiRequest already returns parsed JSON
      } catch (error) {
        console.error("Error in product recommendation API call:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      // Remove typing indicator
      removeTypingIndicator();
      
      // Check if we have categories data (for dynamic categories)
      if (data.categories && !chatState.productPreferences?.category) {
        askForProductCategory(data.categories);
        return;
      }
      
      if (!data.products || data.products.length === 0) {
        addBotMessage("I couldn't find any products matching your preferences. Would you like to try with different criteria?");
        setChatState(prev => ({ ...prev, awaitingProductPreference: false, productPreferenceStep: undefined }));
        return;
      }

      // Log success for debugging
      console.log(`Found ${data.products.length} products to recommend:`, data.products);
      
      // Add typing indicator first
      addTypingIndicator();
      
      // Add product recommendations message after delay
      setTimeout(() => {
        // Remove typing indicator
        removeTypingIndicator();
        
        // Create the product recommendation message
        const message: Message = {
          id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          content: "Based on your preferences, here are some products I recommend:",
          isBot: true,
          timestamp: new Date(),
          type: 'product-recommendations',
          products: data.products.map((product: any) => ({
            title: product.title,
            description: product.description,
            price: product.price || 0,
            imageUrl: product.imageUrl,
            productUrl: product.productUrl
          }))
        };
        
        setMessages(prev => [...prev, message]);
        setChatState(prev => ({ 
          ...prev, 
          awaitingProductPreference: false, 
          productPreferenceStep: undefined 
        }));
      }, 2000); // 2 second delay to simulate typing
    },
    onError: (error) => {
      // Remove typing indicator
      setMessages(prev => prev.filter(msg => msg.type !== 'typing'));
      console.error("Product recommendation error:", error);
      addBotMessage("I'm having trouble finding product recommendations right now. Could you try again later or be more specific about what you're looking for?");
      setChatState(prev => ({ 
        ...prev, 
        awaitingProductPreference: false, 
        productPreferenceStep: undefined 
      }));
    }
  });

  // Function to ask for product preferences
  const askForProductPreferences = async () => {
    setChatState(prev => ({ 
      ...prev, 
      awaitingProductPreference: true,
      productPreferenceStep: undefined,
      productPreferences: {}
    }));
    
    // Add typing indicator
    addTypingIndicator();
    
    // Hard-coded categories as fallback in case the API call fails
    const fallbackCategories = [
      { label: "Dates and Date Products", value: "dates" },
      { label: "Chocolates and Dragees", value: "chocolates" },
      { label: "Baklava and Sweets", value: "sweets" },
      { label: "Dehydrated Vegetables", value: "vegetables" },
      { label: "Coffee and Beverages", value: "coffee" }
    ];
    
    // Skip directly to budget preference to minimize questions
    // Remove typing indicator
    setMessages(prev => prev.filter(msg => msg.type !== 'typing'));
    
    // Set a default category and move to budget step
    setChatState(prev => ({
      ...prev,
      productPreferences: {
        ...prev.productPreferences,
        category: 'all' // Default to all categories
      }
    }));
    
    // Skip to budget preference
    askForBudgetPreference();
  };

  // Function to ask for category preference
  const askForProductCategory = (categories: Array<{label: string, value: string}>) => {
    const message: Message = {
      id: `pref_cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content: "What category interests you?",
      isBot: true,
      timestamp: new Date(),
      type: 'options',
      options: categories
    };
    
    setMessages(prev => prev.filter(msg => msg.type !== 'typing'));
    setMessages(prev => [...prev, message]);
    
    setChatState(prev => ({ 
      ...prev, 
      productPreferenceStep: 'category'
    }));
  };

  // Function to ask for budget preference
  const askForBudgetPreference = () => {
    const budgetOptions = [
      { label: "Budget-friendly", value: "budget-friendly" },
      { label: "Mid-range", value: "mid-range" },
      { label: "Premium", value: "premium" },
      { label: "Any price range", value: "any" }
    ];
    
    const message: Message = {
      id: `pref_budget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content: "What's your budget preference?",
      isBot: true,
      timestamp: new Date(),
      type: 'options',
      options: budgetOptions
    };
    
    setMessages(prev => [...prev, message]);
    setChatState(prev => ({ 
      ...prev, 
      productPreferenceStep: 'budget'
    }));
  };

  // Function to ask for feature preferences
  const askForFeaturePreferences = () => {
    // Features depend on the category
    const category = chatState.productPreferences?.category;
    let featureOptions: Array<{label: string, value: string}> = [];
    
    if (category === 'dates') {
      featureOptions = [
        { label: "Stuffed dates", value: "stuffed" },
        { label: "Regular dates", value: "regular" },
        { label: "Organic", value: "organic" },
        { label: "No preference", value: "none" }
      ];
    } else if (category === 'chocolates') {
      featureOptions = [
        { label: "Dark chocolate", value: "dark" },
        { label: "Milk chocolate", value: "milk" },
        { label: "White chocolate", value: "white" },
        { label: "Caramel", value: "caramel" },
        { label: "No preference", value: "none" }
      ];
    } else if (category === 'vegetables') {
      featureOptions = [
        { label: "Organic", value: "organic" },
        { label: "Root vegetables", value: "root" },
        { label: "Leafy greens", value: "leafy" },
        { label: "No preference", value: "none" }
      ];
    } else {
      featureOptions = [
        { label: "No specific features", value: "none" }
      ];
    }
    
    const message: Message = {
      id: `pref_features_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content: "Do you have any specific features you're looking for?",
      isBot: true,
      timestamp: new Date(),
      type: 'options',
      options: featureOptions
    };
    
    setMessages(prev => [...prev, message]);
    setChatState(prev => ({ 
      ...prev, 
      productPreferenceStep: 'features'
    }));
  };

  // Function to ask for sorting preference
  const askForSortingPreference = () => {
    const sortOptions = [
      { label: "Price: Low to High", value: "price_low" },
      { label: "Price: High to Low", value: "price_high" },
      { label: "Popularity", value: "popularity" },
      { label: "No preference", value: "none" }
    ];
    
    const message: Message = {
      id: `pref_sort_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content: "How would you like the results sorted?",
      isBot: true,
      timestamp: new Date(),
      type: 'options',
      options: sortOptions
    };
    
    setMessages(prev => [...prev, message]);
    setChatState(prev => ({ 
      ...prev, 
      productPreferenceStep: 'sort'
    }));
  };

  // Function to handle product preference selection
  const handleProductPreferenceSelection = (option: string) => {
    const step = chatState.productPreferenceStep;
    
    // Add user's selection as a message
    const optionLabels: Record<string, Record<string, string>> = {
      // Categories are now dynamic, no static mapping needed
      budget: {
        'budget-friendly': 'Budget-friendly',
        'mid-range': 'Mid-range',
        'premium': 'Premium',
        'any': 'Any price range'
      },
      sort: {
        'price_low': 'Price: Low to High',
        'price_high': 'Price: High to Low',
        'popularity': 'Popularity',
        'none': 'No preference'
      }
    };
    
    // Map common text inputs to valid values
    let mappedOption = option;
    
    if (step === 'budget') {
      const lowerOption = option.toLowerCase();
      if (lowerOption.includes('budget') || lowerOption.includes('cheap') || lowerOption.includes('affordable') || lowerOption === 'low' || lowerOption === 'lower') {
        mappedOption = 'budget-friendly';
      } else if (lowerOption.includes('mid') || lowerOption.includes('medium') || lowerOption.includes('moderate')) {
        mappedOption = 'mid-range';
      } else if (lowerOption.includes('premium') || lowerOption.includes('expensive') || lowerOption.includes('high') || lowerOption.includes('luxury')) {
        mappedOption = 'premium';
      } else if (lowerOption.includes('any') || lowerOption.includes('all') || lowerOption.includes('don\'t care')) {
        mappedOption = 'any';
      }
    } else if (step === 'features') {
      const lowerOption = option.toLowerCase();
      if (lowerOption.includes('stuff')) {
        mappedOption = 'stuffed';
      } else if (lowerOption.includes('regular') || lowerOption.includes('plain')) {
        mappedOption = 'regular';
      } else if (lowerOption.includes('organic')) {
        mappedOption = 'organic';
      } else if (lowerOption === 'none' || lowerOption.includes('no preference') || lowerOption.includes('any')) {
        mappedOption = 'none';
      }
    } else if (step === 'sort') {
      const lowerOption = option.toLowerCase();
      if (lowerOption.includes('low to high') || lowerOption.includes('cheapest') || lowerOption.includes('lowest')) {
        mappedOption = 'price_low';
      } else if (lowerOption.includes('high to low') || lowerOption.includes('expensive') || lowerOption.includes('highest')) {
        mappedOption = 'price_high';
      } else if (lowerOption.includes('popular')) {
        mappedOption = 'popularity';
      } else if (lowerOption.includes('no') || lowerOption.includes('any') || lowerOption.includes('don\'t care')) {
        mappedOption = 'none';
      }
    }
    
    // Get the appropriate label for the selected option
    let displayLabel = option;
    
    // For categories, find the label from the last message's options
    if (step === 'category') {
      const lastMessage = messages.filter(msg => msg.type === 'options').pop();
      const categoryOption = lastMessage?.options?.find(opt => opt.value === mappedOption);
      displayLabel = categoryOption?.label || option;
    } else if (step && optionLabels[step] && optionLabels[step][mappedOption]) {
      displayLabel = optionLabels[step][mappedOption];
    }
    
    addUserMessage(displayLabel);
    
    // Update state based on the current step
    if (step === 'category') {
      setChatState(prev => ({
        ...prev,
        productPreferences: {
          ...prev.productPreferences,
          category: mappedOption
        }
      }));
      
      // Next, ask for budget
      askForBudgetPreference();
    } 
    else if (step === 'budget') {
      setChatState(prev => ({
        ...prev,
        productPreferences: {
          ...prev.productPreferences,
          budget: mappedOption
        }
      }));
      
      // Skip features and go directly to product search
      // Add typing indicator
      addTypingIndicator();
      
      // Get product recommendations based on collected preferences
      productRecommendationMutation.mutate({
        preferences: {
          ...chatState.productPreferences,
          budget: mappedOption,
          features: ['none'] // Default feature
        },
        sessionId
      });
    }
    else if (step === 'features') {
      setChatState(prev => ({
        ...prev,
        productPreferences: {
          ...prev.productPreferences,
          features: [mappedOption]
        }
      }));
      
      // Next, ask for sorting preference
      askForSortingPreference();
    }
    else if (step === 'sort') {
      // This is the final step
      const finalPreferences = {
        ...chatState.productPreferences,
        sort: mappedOption === 'none' ? undefined : mappedOption as any
      };
      
      setChatState(prev => ({
        ...prev,
        productPreferences: finalPreferences
      }));
      
      // Add typing indicator
      addTypingIndicator();
      
      // Log the final preferences for debugging
      console.log("Final product preferences:", finalPreferences);
      
      // Get product recommendations based on all collected preferences
      productRecommendationMutation.mutate({
        preferences: finalPreferences,
        sessionId
      });
    }
    else {
      // If no specific step is set, assume it's the category
      setChatState(prev => ({
        ...prev,
        productPreferences: {
          ...prev.productPreferences,
          category: mappedOption
        },
        productPreferenceStep: 'category'
      }));
      
      // Move to the next step
      askForBudgetPreference();
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize with greeting
  useEffect(() => {
    if (statusLoading || !historyLoaded) return;
    
    if (messages.length === 0) {
      if (!isAiConnected) {
        addBotMessage("🤖 Hello! I'm your KarjiStore assistant. AI is not configured, but I can still help track orders!");
      } else {
        addBotMessage("👋 Hello! I'm here to help with orders, products, and questions. How can I assist you?");
      }
    }
  }, [isAiConnected, statusLoading, messages.length, historyLoaded]);

  // Update the addBotMessage function to show typing indicator first
  const addBotMessage = (content: string, sources?: Array<{ title: string; url?: string }>, confidence?: number) => {
    // Add typing indicator first
    addTypingIndicator();
    
    // Remove typing indicator and add the actual message after a delay
    setTimeout(() => {
      removeTypingIndicator();
      
    const message: Message = {
      id: `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content,
      isBot: true,
      timestamp: new Date(),
      sources,
      confidence,
      type: 'text'
    };
    setMessages(prev => [...prev, message]);
    }, 2000); // 2 second delay to simulate typing
  };

  const addTypingIndicator = () => {
    const message: Message = {
      id: `typing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content: "typing",
      isBot: true,
      timestamp: new Date(),
      type: 'typing'
    };
    setMessages(prev => [...prev, message]);
  };

  const removeTypingIndicator = () => {
    setMessages(prev => prev.filter(msg => msg.type !== 'typing'));
  };

  const addUserMessage = (content: string) => {
    const message: Message = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content,
      isBot: false,
      timestamp: new Date(),
      type: 'text'
    };
    setMessages(prev => [...prev, message]);
  };

  // Update the handleCustomProductSearch function to handle direct product queries intelligently
  const handleCustomProductSearch = (query: string) => {
    if (!query.trim()) return;
    
    // Add user message with the search query
    addUserMessage(query);
    
    // Add typing indicator
    addTypingIndicator();
    
    // Set product preferences to include the search query
    setChatState(prev => ({
      ...prev,
      awaitingProductPreference: false, // Don't wait for more preferences, process this directly
      productPreferences: {
        ...prev.productPreferences,
        searchQuery: query
      }
    }));
    
    // Call the product recommendation API with the search query
    productRecommendationMutation.mutate({
      preferences: {
        searchQuery: query,
        ...(chatState.productPreferences || {})
      },
      sessionId
    });
  };

  // Update the handleSendMessage function to use intelligent RAG-based responses
  const handleSendMessage = async () => {
    if (!input.trim()) return;
    
    const userMessage = input.trim();
    setInput("");
    addUserMessage(userMessage);

    // Check for order tracking keywords directly
    const lowerMessage = userMessage.toLowerCase();
    const isOrderTrackingQuery = ['order', 'track', 'shipping', 'delivery', 'package', 'status', 'where is my']
      .some(keyword => lowerMessage.includes(keyword));
    
    // Handle order tracking flow
    if (isOrderTrackingQuery && !chatState.awaitingEmail && !chatState.awaitingOrderId && !isInOrderTrackingFlow) {
      setIsInOrderTrackingFlow(true);
      setChatState({ awaitingEmail: true, awaitingOrderId: false });
      addBotMessage("I'll help you track your order. Please provide your email address first.");
      return;
    }
    
    // Handle email input for order tracking
    if (chatState.awaitingEmail || isInOrderTrackingFlow) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRegex.test(userMessage)) {
        setChatState(prev => ({ ...prev, email: userMessage, awaitingEmail: false, awaitingOrderId: true }));
        addBotMessage("Thank you! Now please provide your order ID or order number.");
        return;
      } else if (chatState.awaitingEmail) {
        addBotMessage("Please enter a valid email (example@email.com)");
        return;
      }
    }

    // Handle order ID input for order tracking
    if (chatState.awaitingOrderId || isInOrderTrackingFlow) {
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

    // If we're in the product preference flow and the user enters a direct query
    if (chatState.awaitingProductPreference) {
    const lowerMessage = userMessage.toLowerCase();
      
      // Check if this is a valid selection for the current preference step
      if (chatState.productPreferenceStep === 'category') {
        // Map common variations to category values
        const categoryMap: Record<string, string> = {
          'chocolate': 'chocolates',
          'chocolates': 'chocolates',
          'sweet': 'sweets',
          'sweets': 'sweets',
          'coffee': 'coffee',
          'date': 'dates',
          'dates': 'dates',
          'vegetable': 'vegetables',
          'vegetables': 'vegetables',
          'general': 'all' // Handle "general" as "all categories"
        };
        
        const matchedCategory = Object.keys(categoryMap).find(key => lowerMessage.includes(key));
        if (matchedCategory) {
          handleProductPreferenceSelection(categoryMap[matchedCategory]);
          return;
        }
      } else if (chatState.productPreferenceStep === 'budget') {
        // Check for budget keywords
        if (lowerMessage.includes('budget') || lowerMessage.includes('cheap') || lowerMessage.includes('affordable')) {
          handleProductPreferenceSelection('budget-friendly');
          return;
        } else if (lowerMessage.includes('mid') || lowerMessage.includes('medium')) {
          handleProductPreferenceSelection('mid-range');
          return;
        } else if (lowerMessage.includes('premium') || lowerMessage.includes('expensive') || lowerMessage.includes('luxury')) {
          handleProductPreferenceSelection('premium');
          return;
        } else if (lowerMessage.includes('any') || lowerMessage.includes('all') || lowerMessage.includes('no preference')) {
          handleProductPreferenceSelection('any');
          return;
        }
      }
      
      // If it's not a recognized preference selection, treat it as a direct product search
      handleCustomProductSearch(userMessage);
      return;
    }

    // For all other queries, use the intelligent AI/RAG system
    if (isAiConnected) {
      // Add typing indicator
      addTypingIndicator();
      
      // Get the current session ID from localStorage to ensure we're using the latest one
      const currentSessionId = getCurrentSessionId() || sessionId;
      
      console.log('Sending chat message with sessionId:', currentSessionId);
      console.log('Component sessionId:', sessionId);
      console.log('Current sessionId from localStorage:', getCurrentSessionId());
      console.log('SessionId match:', currentSessionId === sessionId);
      
      chatMutation.mutate({
        content: userMessage,
        sessionId: currentSessionId,
        isBot: false
      }, {
        onSuccess: (response) => {
          // Remove the typing indicator
          removeTypingIndicator();
          
          // Update session ID from backend response if provided
          updateSessionId(response.sessionId);
          
          console.log('Chat response:', {
            message: response.message,
            intent: response.intent,
            shouldStartProductFlow: response.shouldStartProductFlow,
            hasProducts: !!response.products && response.products.length > 0,
            type: response.type,
            sessionId: response.sessionId || sessionId
          });
          
          // IMPORTANT: Always prioritize shouldStartProductFlow flag over the presence of products
          // If shouldStartProductFlow is true, start the preference collection flow regardless of products
          if (response.shouldStartProductFlow) {
            // Show the AI's response first
            addBotMessage(
              response.message || "I can help you find products!",
              response.sources,
              response.confidence
            );
            
            // Then start the product recommendation flow
            setTimeout(() => {
              askForProductPreferences();
            }, 1000);
          }
          // Only show products if shouldStartProductFlow is false and we have products
          else if (response.type === 'product-recommendations' && response.products && response.products.length > 0) {
            // Create a product recommendation message with the products
            const message: Message = {
              id: `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              content: response.message || "Here are some products that match your search:",
              isBot: true,
              timestamp: new Date(),
              type: 'product-recommendations',
              products: response.products.map((product: any) => ({
                title: product.title,
                description: product.description,
                price: product.price || 0,
                imageUrl: product.imageUrl,
                productUrl: product.productUrl
              }))
            };
            setMessages(prev => [...prev, message]);
          } else if (response.intent === 'product_search') {
            // For product_search intent, check if there are products in the response
            if (response.products && response.products.length > 0) {
              // Create a product recommendation message with the products
              const message: Message = {
                id: `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                content: response.message || "Here are some products that match your search:",
                isBot: true,
                timestamp: new Date(),
                type: 'product-recommendations',
                products: response.products.map((product: any) => ({
                  title: product.title,
                  description: product.description,
                  price: product.price || 0,
                  imageUrl: product.imageUrl,
                  productUrl: product.productUrl
                }))
              };
              setMessages(prev => [...prev, message]);
            } else {
              // If no products in response, just show the text response
              addBotMessage(
                response.message || "Here are some products that match your search:",
                response.sources,
                response.confidence
              );
            }
          } else {
            // For all other intents, just show the AI response
            addBotMessage(
              response.message || "I'm here to help! How can I assist you?",
              response.sources,
              response.confidence
            );
          }
        },
        onError: () => {
          // Remove the typing indicator
          removeTypingIndicator();
          addBotMessage("Technical issue. Try again or track an order.");
        }
      });
    } else {
      // Without AI, provide a helpful fallback message with order tracking option
      const message: Message = {
        id: `options_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content: "AI not configured. I can help with:",
        isBot: true,
        timestamp: new Date(),
        type: 'options',
        options: [
          { label: "Track my order", value: "track-order" },
          { label: "Browse products", value: "product-recommendations" },
          { label: "Get help", value: "help" }
        ]
      };
      setMessages(prev => [...prev, message]);
    }
  };

  // Add a custom search handler for product recommendations
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const restartChat = () => {
    // Generate a new session ID and save it
    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('chatSessionId', newSessionId);
    
    // Clear messages and reset state
    setMessages([]);
    setChatState({ awaitingEmail: false, awaitingOrderId: false });
    setIsInOrderTrackingFlow(false);
    
    // Clear stored messages for the old session
    localStorage.removeItem(`chatMessages_${sessionId}`);
    
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

  // Update the option selection handler to handle product preferences
  const handleOptionSelection = (option: string) => {
    if (chatState.awaitingProductPreference) {
      handleProductPreferenceSelection(option);
    } else {
      // Handle other option selections
      if (option === 'track-order') {
        setIsInOrderTrackingFlow(true);
        setChatState({ awaitingEmail: true, awaitingOrderId: false });
        addBotMessage("I'll help you track your order. Please provide your email address first.");
      } else if (option === 'product-recommendations') {
        askForProductPreferences();
      } else if (option === 'order-not-found') {
        addBotMessage("Order not found. Try again or contact support.");
      } else if (option === 'contact-support') {
        addBotMessage("Contact us: support@karjistore.com or (555) 123-4567");
      } else if (option === 'help') {
        addBotMessage("I can help you with:\n• Tracking your order\n• Finding products\n• Answering questions about our store\n\nWhat would you like help with?");
      }
    }
  };

  // Handle option selection
  const handleOptionSelect = (option: string) => {
    if (chatState.awaitingProductPreference) {
      handleProductPreferenceSelection(option);
    } else {
      // Handle other option selections
      if (option === 'track-order') {
        setIsInOrderTrackingFlow(true);
        setChatState({ awaitingEmail: true, awaitingOrderId: false });
        addBotMessage("I'll help you track your order. Please provide your email address first.");
      } else if (option === 'product-recommendations') {
        askForProductPreferences();
      } else if (option === 'order-not-found') {
        addBotMessage("Order not found. Try again or contact support.");
      } else if (option === 'contact-support') {
        addBotMessage("Contact us: support@karjistore.com or (555) 123-4567");
      } else if (option === 'help') {
        addBotMessage("I can help you with:\n• Tracking your order\n• Finding products\n• Answering questions about our store\n\nWhat would you like help with?");
      }
    }
  };

  return (
    <div className={`${isWidget ? 'h-full' : 'w-full h-full'} flex flex-col ${themeStyles.container}`}>
      {/* Chat Header */}
      {!isWidget && (
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
      )}

      {/* AI Status Warning */}
      {!isAiConnected && !isWidget && (
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
      <div className={`flex-1 overflow-y-auto ${isWidget ? 'p-3' : 'p-4'} space-y-3 min-h-0`}>
        {messages.map((message) => (
          <ChatMessage 
            key={message.id} 
            message={message} 
            onOptionSelect={handleOptionSelect}
            onOrderTracking={(data) => {
              const orderResultMessage: Message = {
                id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                content: `I found your order #${data.order.orderNumber}. Current status: ${data.order.status}`,
                isBot: true,
                timestamp: new Date(),
                type: 'order-result',
                orderData: data
              };
              setMessages(prev => [...prev, orderResultMessage]);
            }}
            sessionId={sessionId}
            onCustomSearch={handleCustomProductSearch}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <div className={`border-t ${themeStyles.borderColor} ${isWidget ? 'p-2' : 'p-4'}`}>
        <div className="flex space-x-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={getPlaceholder()}
            disabled={chatMutation.isPending || trackOrderMutation.isPending || productRecommendationMutation.isPending}
            className={`flex-1 ${isWidget ? 'text-sm py-1 px-2 h-8' : ''} ${themeStyles.input}`}
          />
          <Button 
            onClick={handleSendMessage}
            disabled={!input.trim() || chatMutation.isPending || trackOrderMutation.isPending || productRecommendationMutation.isPending}
            className={`${isWidget ? 'h-8 py-0 px-3 text-sm' : ''} ${themeStyles.button}`}
          >
            {chatMutation.isPending || trackOrderMutation.isPending || productRecommendationMutation.isPending ? 'Sending...' : 'Send'}
          </Button>
        </div>
        
        {chatState.awaitingEmail && (
          <div className={`mt-2 text-sm ${themeStyles.textColor}`}>
            Please enter the email address associated with your order.
          </div>
        )}
        
        {chatState.awaitingOrderId && (
          <div className={`mt-2 text-sm ${themeStyles.textColor}`}>
            Please enter your order ID or order number.
          </div>
        )}
      </div>
    </div>
  );
});

export default Chatbot;