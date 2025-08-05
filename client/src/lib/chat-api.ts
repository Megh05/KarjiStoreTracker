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
  return await apiRequest("/api/track-order", {
    method: 'POST',
    body: JSON.stringify(data)
  });
};

export const sendChatMessage = async (data: ChatMessageRequest) => {
  return await apiRequest("/api/chat/message", {
    method: 'POST',
    body: JSON.stringify(data)
  });
};

export const getChatHistory = async (sessionId: string) => {
  return await apiRequest(`/api/chat/history/${sessionId}`);
};
