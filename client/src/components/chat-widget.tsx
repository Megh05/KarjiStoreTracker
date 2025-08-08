import React, { useState, useEffect } from 'react';
import ChatBotLuxury, { Product } from './ChatBotLuxury';

// Function to get or create a persistent session ID
const getSessionId = (): string => {
  let sessionId = localStorage.getItem('chatSessionId');
  if (!sessionId) {
    // Generate a new session ID
    sessionId = `session_${Date.now()}`;
    localStorage.setItem('chatSessionId', sessionId);
    console.log('Generated new sessionId:', sessionId);
  } else {
    console.log('Using existing sessionId:', sessionId);
  }
  return sessionId;
};

export default function ChatWidget() {
  // Use state to store the session ID
  const [sessionId] = useState(() => getSessionId());

  // Custom message handler function
  const handleSendMessage = async (message: string): Promise<string | { message: string; products?: Product[] }> => {
    try {
      // Make API call to the server with the persistent sessionId
      const response = await fetch('/api/chat/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': sessionId, // Add session ID to headers as well for redundancy
        },
        body: JSON.stringify({
          content: message,
          sessionId: sessionId, // Use the persistent session ID
          isBot: false
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to send message');
      }
      
      const data = await response.json();
      
      // Update session ID if returned from server
      if (data.sessionId && data.sessionId !== sessionId) {
        localStorage.setItem('chatSessionId', data.sessionId);
        console.log('Updated sessionId from server:', data.sessionId);
      }
      
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