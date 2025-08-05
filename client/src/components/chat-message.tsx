import { Bot, User, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import OrderTimeline from "@/components/order-timeline";
import type { Message, OrderTrackingData } from "@/pages/chatbot";

interface ChatMessageProps {
  message: Message;
  onOptionSelect: (option: string) => void;
  onOrderTracking: (data: OrderTrackingData) => void;
  sessionId: string;
  onCustomSearch?: (query: string) => void;
}

export default function ChatMessage({ 
  message, 
  onOptionSelect, 
  onOrderTracking,
  sessionId,
  onCustomSearch
}: ChatMessageProps) {
  const [trackingEmail, setTrackingEmail] = useState("");
  const [trackingOrderId, setTrackingOrderId] = useState("");
  const [showTimeline, setShowTimeline] = useState(false);
  const [customSearchQuery, setCustomSearchQuery] = useState("");
  const [showCustomSearch, setShowCustomSearch] = useState(false);
  const { toast } = useToast();

  const trackOrderMutation = useMutation({
    mutationFn: async (data: { email: string; orderId: string }) => {
      return apiRequest("/api/track-order", {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: (data: OrderTrackingData) => {
      onOrderTracking(data);
      toast({
        title: "Order Found!",
        description: `Order ${data.order.orderNumber} has been successfully located.`,
      });
    },
    onError: (error: any) => {
      // Show a friendly error message asking user to try again
      onOptionSelect('order-not-found');
    }
  });

  const handleTrackOrder = () => {
    if (!trackingEmail || !trackingOrderId) {
      toast({
        title: "Missing Information",
        description: "Please fill in both email and order ID",
        variant: "destructive",
      });
      return;
    }

    trackOrderMutation.mutate({
      email: trackingEmail,
      orderId: trackingOrderId
    });
  };

  const handleCustomSearch = () => {
    if (customSearchQuery.trim() && onCustomSearch) {
      onCustomSearch(customSearchQuery);
      setCustomSearchQuery("");
      setShowCustomSearch(false);
    }
  };

  // Fix the RegExp iterator issue in the extractedProducts function

  const extractedProducts = useMemo(() => {
    if (!message.content || message.type === 'product-recommendations' || !message.isBot) {
      return null;
    }

    // Enhanced pattern to detect both numbered and bullet-style product listings
    // This will match patterns like:
    // 1. **Product Name**: Description
    // **Product Name** - Description
    // • **Product Name**: Description
    const productPatterns = [
      /\*\*([^*]+)\*\*\s*-\s*([^*•\d]+)/g,                  // **Product Name** - Description
      /\*\*([^*]+)\*\*:\s*([^*•\d]+)/g,                     // **Product Name**: Description
      /\d+\.\s*\*\*([^*]+)\*\*:\s*([^*•\d][^*•]*)/g,        // 1. **Product Name**: Description
      /\d+\.\s*\*\*([^*]+)\*\*\s*-\s*([^*•\d][^*•]*)/g      // 1. **Product Name** - Description
    ];
    
    let allMatches = [];
    
    // Try each pattern and collect all matches using a safer approach
    for (const pattern of productPatterns) {
      // Reset the RegExp for each iteration
      const regex = new RegExp(pattern);
      let match;
      let tempContent = message.content;
      
      // Find all matches for this pattern
      while ((match = regex.exec(tempContent)) !== null) {
        allMatches.push(match);
        // Move past this match to find the next one
        tempContent = tempContent.substring(match.index + match[0].length);
        // Reset regex lastIndex
        regex.lastIndex = 0;
      }
    }
    
    if (allMatches.length === 0) return null;
    
    // Extract product information
    return allMatches.map((match, index) => {
      const title = match[1].trim();
      const description = match[2].trim();
      
      // Extract price if available (simple pattern matching)
      const priceMatch = description.match(/(\d+(\.\d{1,2})?)\s*(AED|USD|\$|£|€)/i);
      const price = priceMatch ? parseFloat(priceMatch[1]) : 0;
      
      return {
        title,
        description,
        price,
        imageUrl: null, // No image in text format
        productUrl: "#" // No URL in text format
      };
    });
  }, [message.content, message.type, message.isBot]);

  const formatMessageContent = (content: string) => {
    // If this is a product-recommendations message, only show the first part (before product listings)
    if (message.type === 'product-recommendations') {
      // For product recommendation messages, just show a brief intro without product details
      // Extract just the introductory text - first paragraph or two
      const introText = content.split('\n\n')[0]; // Take just the first paragraph
      
      return (
        <>
          {introText.split('\n').map((line, index) => (
            <div key={index}>
              <span>{line}</span>
            </div>
          ))}
        </>
      );
    }
    
    // If we've extracted products, don't render the product part of the message
    if (extractedProducts && extractedProducts.length > 0) {
      // Extract the introductory text before product listings
      // Look for the first occurrence of a numbered list or bullet point with product
      const splitPatterns = [
        /\d+\.\s*\*\*/,  // 1. **Product
        /•\s*\*\*/,      // • **Product
        /\*\*/           // **Product
      ];
      
      let introText = content;
      
      for (const pattern of splitPatterns) {
        const match = content.match(pattern);
        if (match && match.index) {
          introText = content.substring(0, match.index).trim();
          break;
        }
      }
      
      return (
        <>
          {introText.split('\n').map((line, index) => (
            <div key={index}>
              <span>{line}</span>
            </div>
          ))}
        </>
      );
    }
    
    // Default formatting for regular messages
    return content
      .split('\n')
      .map((line, index) => (
        <div key={index}>
          {line.startsWith('**') && line.endsWith('**') ? (
            <strong>{line.slice(2, -2)}</strong>
          ) : line.startsWith('• ') ? (
            <div className="flex items-start space-x-2 text-sm">
              <span className="text-amber-600">✓</span>
              <span>{line.slice(2)}</span>
            </div>
          ) : (
            <span>{line}</span>
          )}
        </div>
      ));
  };

  const renderTypingIndicator = () => {
    return (
      <div className="flex space-x-2">
        <div className="w-3 h-3 bg-amber-600 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
        <div className="w-3 h-3 bg-amber-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
        <div className="w-3 h-3 bg-amber-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
      </div>
    );
  };

  // Enhanced product recommendation cards with elegant design
  const renderProductRecommendations = () => {
    // Use either the products from message.products or the extracted products
    const products = message.products || extractedProducts;
    
    if (!products || products.length === 0) {
      return <div>No products found matching your criteria.</div>;
    }

    // Log products for debugging
    console.log('Product data (raw):', JSON.stringify(products, null, 2));
    
    // Function to safely open URL in a new tab
    const openInNewTab = (url: string) => {
      // Ensure URL is absolute
      let fullUrl = url;
      if (!url.startsWith('http')) {
        fullUrl = `https://www.karjistore.com${url.startsWith('/') ? url : '/' + url}`;
      }
      
      console.log(`Opening URL: ${fullUrl} (original: ${url})`);
      
      // Create a new window/tab with the URL
      const newTab = window.open();
      if (newTab) {
        newTab.opener = null; // Remove reference to opener
        newTab.location.href = fullUrl;
      }
    };

    return (
      <div className="mt-3 space-y-3">
        {/* Custom search button - more compact */}
        <div className="mb-2">
          {showCustomSearch ? (
            <div className="flex space-x-1">
              <Input 
                type="text" 
                value={customSearchQuery}
                onChange={(e) => setCustomSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="flex-1 h-8 text-xs"
                onKeyDown={(e) => e.key === 'Enter' && handleCustomSearch()}
              />
              <Button 
                onClick={handleCustomSearch}
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 h-8 px-2 py-0"
              >
                <Search className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={() => setShowCustomSearch(true)}
              className="w-full text-xs h-7 border-dashed border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
            >
              <Search className="h-3 w-3 mr-1" /> Find specific products
            </Button>
          )}
        </div>
        
        {/* Product grid for better layout */}
        <div className="grid grid-cols-1 gap-2">
          {products.map((product, index) => {
            // Ensure product URL is absolute
            let productUrl = product.productUrl || '';
            if (!productUrl.startsWith('http')) {
              productUrl = `https://www.karjistore.com${productUrl.startsWith('/') ? productUrl : '/' + productUrl}`;
            }
            
            // Format price for display - ensure we have a valid number
            let priceValue = 0;
            if (typeof product.price === 'string') {
              priceValue = parseFloat(product.price);
            } else if (typeof product.price === 'number') {
              priceValue = product.price;
            }
            
            const formattedPrice = !isNaN(priceValue) && priceValue > 0
              ? `${priceValue.toFixed(2)} AED`
              : 'Price upon request';

            // Debug log for product details
            console.log(`Product ${index} details:`, {
              title: product.title,
              originalUrl: product.productUrl,
              processedUrl: productUrl,
              originalPrice: product.price,
              priceType: typeof product.price,
              parsedPrice: priceValue,
              formattedPrice: formattedPrice,
              originalImage: product.imageUrl
            });
            
            // Ensure image URL is absolute
            let imageUrl = product.imageUrl || '';
            if (imageUrl && !imageUrl.startsWith('http')) {
              imageUrl = `https://www.karjistore.com${imageUrl.startsWith('/') ? imageUrl : '/' + imageUrl}`;
            }
            
            console.log(`Product ${index} processed image URL: ${imageUrl}`);
            
            return (
              <div 
                key={index}
                className="bg-white border border-neutral-50 rounded-lg overflow-hidden shadow-sm hover:shadow transition-all duration-200 group cursor-pointer"
                onClick={() => openInNewTab(productUrl)}
              >
                <div className="flex items-center p-0">
                  {/* Product image - smaller */}
                  <div className="w-16 h-16 bg-gradient-to-br from-slate-50 to-gray-50 flex items-center justify-center">
                    {imageUrl ? (
                      <img 
                        src={imageUrl} 
                        alt={product.title}
                        className="w-full h-full object-contain transition-transform group-hover:scale-105"
                        onError={(e) => {
                          // Replace broken image with placeholder
                          e.currentTarget.onerror = null;
                          e.currentTarget.style.display = 'none';
                          console.error(`Image failed to load: ${imageUrl}`);
                          const parent = e.currentTarget.parentElement;
                          if (parent) {
                            const placeholder = document.createElement('div');
                            placeholder.className = 'w-full h-full flex items-center justify-center text-gray-200';
                            placeholder.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>`;
                            parent.appendChild(placeholder);
                          }
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-200">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  
                  {/* Product info - more compact */}
                  <div className="flex-1 p-2 pl-3 flex flex-col min-w-0">
                    <h3 className="font-medium text-sm text-amber-800 truncate mb-1 group-hover:text-amber-600 transition-colors">{product.title}</h3>
                    
                    <div className="text-xs text-neutral-500 line-clamp-2 mb-1">
                      {product.description ? (
                        <div dangerouslySetInnerHTML={{ 
                          __html: product.description.replace(/<\/?[^>]+(>|$)/g, "").substring(0, 80) + (product.description.length > 80 ? '...' : '')
                        }} />
                      ) : (
                        <p>No description available</p>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between mt-1">
                      <div className="font-medium text-xs text-amber-600">{formattedPrice}</div>
                      
                      <button
                        className="inline-flex items-center justify-center px-2 py-1 bg-gradient-to-br from-amber-600 via-yellow-600 to-amber-700 hover:from-amber-500 hover:via-yellow-500 hover:to-amber-600 text-white text-xs font-medium rounded transition-colors"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent parent onClick from firing
                          openInNewTab(productUrl);
                        }}
                      >
                        View Product
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex items-start space-x-3 animate-fade-in">
      {message.isBot ? (
        <>
          <div className="w-10 h-10 bg-gradient-to-br from-amber-600 via-yellow-600 to-amber-700 rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
            <Bot className="text-white w-5 h-5" />
          </div>
          <div className="bg-gray-50 rounded-2xl rounded-tl-sm p-4 shadow-sm border border-gray-100 max-w-md">
            <div className="text-gray-800 text-sm leading-relaxed">
              {message.type === 'typing' ? renderTypingIndicator() : formatMessageContent(message.content)}
            </div>
            
            {message.type === 'options' && message.options && (
              <div className="mt-3 space-y-2">
                {message.options.map((option) => (
                  <Button
                    key={option.value}
                    variant="ghost"
                    className="w-full justify-start p-3 h-auto bg-gray-50 hover:bg-amber-50 hover:text-amber-800 transition-all duration-200 text-sm font-medium border border-gray-200 hover:border-amber-200"
                    onClick={() => onOptionSelect(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            )}

            {message.type === 'form' && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-600 mb-2">Enter your details:</p>
                <Input
                  type="email"
                  placeholder="Your email address"
                  value={trackingEmail}
                  onChange={(e) => setTrackingEmail(e.target.value)}
                  className="mb-2 text-sm bg-white border-gray-200 focus:ring-amber-400 focus:border-amber-400"
                />
                <Input
                  type="text"
                  placeholder="Order ID or Order Number"
                  value={trackingOrderId}
                  onChange={(e) => setTrackingOrderId(e.target.value)}
                  className="mb-3 text-sm bg-white border-gray-200 focus:ring-amber-400 focus:border-amber-400"
                />
                <Button
                  onClick={handleTrackOrder}
                  disabled={trackOrderMutation.isPending}
                  className="w-full text-sm font-medium bg-gradient-to-br from-amber-600 via-yellow-600 to-amber-700 hover:from-amber-500 hover:via-yellow-500 hover:to-amber-600"
                >
                  {trackOrderMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Tracking Order...
                    </>
                  ) : (
                    "🔍 Track Order"
                  )}
                </Button>
              </div>
            )}

            {message.type === 'order-result' && message.orderData && (
              <div className="mt-3">
                <Button
                  onClick={() => setShowTimeline(!showTimeline)}
                  variant="outline"
                  className="w-full justify-between text-sm font-medium bg-gray-50 hover:bg-amber-50 border border-gray-200 hover:border-amber-200 transition-colors"
                >
                  <span>📈 View Progress</span>
                  <ChevronRight className={`w-4 h-4 transition-transform ${showTimeline ? 'rotate-90' : ''}`} />
                </Button>
                
                {showTimeline && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h4 className="font-semibold text-gray-800 mb-3">Order Timeline</h4>
                    <OrderTimeline timeline={message.orderData.timeline} />
                  </div>
                )}
              </div>
            )}

            {/* Show product recommendations for both explicit product-recommendations type 
                and for regular messages that contain extracted products */}
            {(message.type === 'product-recommendations' && message.products) || 
             (extractedProducts && extractedProducts.length > 0) ? (
              renderProductRecommendations()
            ) : null}
          </div>
        </>
      ) : (
        <>
          <div className="flex-1"></div>
          <div className="bg-amber-50 text-gray-800 rounded-2xl rounded-tr-sm p-4 shadow-sm max-w-md border border-amber-100">
            <p className="text-sm leading-relaxed">{formatMessageContent(message.content)}</p>
          </div>
          <div className="w-10 h-10 bg-gradient-to-br from-gray-400 via-gray-500 to-gray-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
            <User className="text-white w-5 h-5" />
          </div>
        </>
      )}
    </div>
  );
}
