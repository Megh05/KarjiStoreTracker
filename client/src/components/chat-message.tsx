import { Bot, User, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
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
}

export default function ChatMessage({ 
  message, 
  onOptionSelect, 
  onOrderTracking,
  sessionId 
}: ChatMessageProps) {
  const [trackingEmail, setTrackingEmail] = useState("");
  const [trackingOrderId, setTrackingOrderId] = useState("");
  const [showTimeline, setShowTimeline] = useState(false);
  const { toast } = useToast();

  const trackOrderMutation = useMutation({
    mutationFn: async (data: { email: string; orderId: string }) => {
      const response = await apiRequest("POST", "/api/track-order", data);
      return response.json();
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

  const formatMessageContent = (content: string) => {
    if (content === "typing") {
      return (
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
          <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>
      );
    }

    // Convert markdown-style formatting
    return content
      .split('\n')
      .map((line, index) => (
        <div key={index}>
          {line.startsWith('**') && line.endsWith('**') ? (
            <strong>{line.slice(2, -2)}</strong>
          ) : line.startsWith('• ') ? (
            <div className="flex items-start space-x-2 text-sm">
              <span className="text-secondary">✓</span>
              <span>{line.slice(2)}</span>
            </div>
          ) : (
            <span>{line}</span>
          )}
        </div>
      ));
  };

  return (
    <div className="flex items-start space-x-3 animate-fade-in">
      {message.isBot ? (
        <>
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
            <Bot className="text-white w-4 h-4" />
          </div>
          <div className="bg-white rounded-2xl rounded-tl-sm p-4 shadow-sm border border-neutral-100 max-w-md">
            <div className="text-neutral-700">
              {formatMessageContent(message.content)}
            </div>
            
            {message.type === 'options' && message.options && (
              <div className="mt-3 space-y-2">
                {message.options.map((option) => (
                  <Button
                    key={option.value}
                    variant="ghost"
                    className="w-full justify-start p-3 h-auto bg-neutral-50 hover:bg-primary hover:text-white transition-all duration-200 text-sm font-medium"
                    onClick={() => onOptionSelect(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            )}

            {message.type === 'form' && (
              <div className="mt-3 p-3 bg-neutral-50 rounded-lg">
                <p className="text-sm text-neutral-600 mb-2">Enter your details:</p>
                <Input
                  type="email"
                  placeholder="Your email address"
                  value={trackingEmail}
                  onChange={(e) => setTrackingEmail(e.target.value)}
                  className="mb-2 text-sm"
                />
                <Input
                  type="text"
                  placeholder="Order ID or Order Number"
                  value={trackingOrderId}
                  onChange={(e) => setTrackingOrderId(e.target.value)}
                  className="mb-3 text-sm"
                />
                <Button
                  onClick={handleTrackOrder}
                  disabled={trackOrderMutation.isPending}
                  className="w-full text-sm font-medium"
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
                  className="w-full justify-between text-sm font-medium bg-neutral-50 hover:bg-neutral-100 transition-colors"
                >
                  <span>📈 View Progress</span>
                  <ChevronRight className={`w-4 h-4 transition-transform ${showTimeline ? 'rotate-90' : ''}`} />
                </Button>
                
                {showTimeline && (
                  <div className="mt-4 p-4 bg-neutral-50 rounded-lg">
                    <h4 className="font-semibold text-neutral-800 mb-3">Order Timeline</h4>
                    <OrderTimeline timeline={message.orderData.timeline} />
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex-1"></div>
          <div className="bg-primary rounded-2xl rounded-tr-sm p-4 text-white max-w-md">
            {formatMessageContent(message.content)}
          </div>
          <div className="w-8 h-8 bg-neutral-300 rounded-full flex items-center justify-center flex-shrink-0">
            <User className="text-neutral-600 w-4 h-4" />
          </div>
        </>
      )}
    </div>
  );
}
