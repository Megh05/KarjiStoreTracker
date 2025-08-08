import { apiRequest } from "@/lib/queryClient";
import type { OrderTrackingData } from "@/pages/chatbot";

export interface TrackOrderRequest {
  email: string;
  orderId: string;
}

export interface ChatMessageRequest {
  sessionId: string;
  content: string;
  isBot: boolean;
}

export interface AgentMessageRequest {
  sessionId: string;
  content: string;
}

export const trackOrder = async (data: TrackOrderRequest): Promise<OrderTrackingData> => {
  return await apiRequest("/api/track-order", {
    method: 'POST',
    body: JSON.stringify(data)
  });
};

export const sendChatMessage = async (data: ChatMessageRequest) => {
  // Get the current session ID from localStorage to ensure consistency
  const currentSessionId = localStorage.getItem('chatSessionId');
  
  // If we have a session ID in localStorage but it's different from the one in the request,
  // update the request to use the localStorage session ID
  if (currentSessionId && data.sessionId !== currentSessionId) {
    console.log(`Updating sessionId in request from ${data.sessionId} to ${currentSessionId}`);
    data.sessionId = currentSessionId;
  }
  
  // Add the session ID to headers for redundancy
  const headers = { 'X-Session-ID': data.sessionId };
  
  return await apiRequest("/api/chat/message", {
    method: 'POST',
    headers,
    body: JSON.stringify(data)
  });
};

export const getChatHistory = async (sessionId: string) => {
  // Get the current session ID from localStorage to ensure consistency
  const currentSessionId = localStorage.getItem('chatSessionId');
  
  // Use the localStorage session ID if available and different from the provided one
  if (currentSessionId && sessionId !== currentSessionId) {
    console.log(`Using sessionId from localStorage (${currentSessionId}) instead of provided sessionId (${sessionId})`);
    sessionId = currentSessionId;
  }
  
  // Add the session ID to headers for redundancy
  const headers = { 'X-Session-ID': sessionId };
  
  return await apiRequest(`/api/chat/history/${sessionId}`, { headers });
};

/**
 * Send a message to the agent-based chat system
 */
export const sendAgentMessage = async (data: AgentMessageRequest) => {
  // Get the current session ID from localStorage to ensure consistency
  const currentSessionId = localStorage.getItem('chatSessionId');
  
  // If we have a session ID in localStorage but it's different from the one in the request,
  // update the request to use the localStorage session ID
  if (currentSessionId && data.sessionId !== currentSessionId) {
    console.log(`Updating sessionId in agent request from ${data.sessionId} to ${currentSessionId}`);
    data.sessionId = currentSessionId;
  }
  
  // Add the session ID to headers for redundancy
  const headers = { 'X-Session-ID': data.sessionId };
  
  return await apiRequest("/api/agent/message", {
    method: 'POST',
    headers,
    body: JSON.stringify(data)
  });
};

/**
 * Get chat history from the agent-based system
 */
export const getAgentChatHistory = async (sessionId: string) => {
  // Get the current session ID from localStorage to ensure consistency
  const currentSessionId = localStorage.getItem('chatSessionId');
  
  // Use the localStorage session ID if available and different from the provided one
  if (currentSessionId && sessionId !== currentSessionId) {
    console.log(`Using sessionId from localStorage (${currentSessionId}) instead of provided sessionId (${sessionId})`);
    sessionId = currentSessionId;
  }
  
  // Add the session ID to headers for redundancy
  const headers = { 'X-Session-ID': sessionId };
  
  return await apiRequest(`/api/agent/history/${sessionId}`, { headers });
};
