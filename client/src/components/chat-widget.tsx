import React from 'react';
import ChatBotLuxury, { Product } from './ChatBotLuxury';

export default function ChatWidget() {
  // Custom message handler function
  const handleSendMessage = async (message: string): Promise<string | { message: string; products?: Product[] }> => {
    try {
      // Make API call to the server
      const response = await fetch('/api/chat/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: message,
          sessionId: `session_${Date.now()}`,
          isBot: false
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to send message');
      }
      
      const data = await response.json();
      
      // Check if the response contains products
      if (data.products && data.products.length > 0) {
        return {
          message: data.message || "Here are some products you might like:",
          products: data.products
        };
      }
      
      return data.message || "Thank you for your message. I'll get back to you shortly.";
    } catch (error) {
      console.error('Error sending message:', error);
      return "I apologize, but I'm having trouble connecting right now. Please try again in a moment.";
    }
  };

  return (
    <ChatBotLuxury 
      onSendMessage={handleSendMessage}
      title="KarjiStore Concierge"
      subtitle="Luxury Assistant"
      welcomeMessage="Welcome to KarjiStore's luxury shopping experience. I'm your personal concierge, ready to assist you with our premium collections, order tracking, and more."
    />
  );
} 