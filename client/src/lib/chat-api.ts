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

export const trackOrder = async (data: TrackOrderRequest): Promise<OrderTrackingData> => {
  const response = await apiRequest("POST", "/api/track-order", data);
  return response.json();
};

export const sendChatMessage = async (data: ChatMessageRequest) => {
  const response = await apiRequest("POST", "/api/chat/message", data);
  return response.json();
};

export const getChatHistory = async (sessionId: string) => {
  const response = await apiRequest("GET", `/api/chat/history/${sessionId}`);
  return response.json();
};
