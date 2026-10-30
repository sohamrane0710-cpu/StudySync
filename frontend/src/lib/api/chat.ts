import { apiClient } from './client';
import type {
  ChatMessage,
  ChatMessagesResponse,
  SendMessagePayload,
  EditMessagePayload,
} from '@/types/chat';

export const chatApi = {
  getMessages: (roomId: string, params?: { before?: string; limit?: number }) =>
    apiClient.get<ChatMessagesResponse>(`/rooms/${roomId}/messages`, {
      params: params as Record<string, string | number | boolean | undefined | null>,
    }),
  sendMessage: (roomId: string, data: SendMessagePayload) =>
    apiClient.post<ChatMessage>(`/rooms/${roomId}/messages`, data),
  editMessage: (roomId: string, messageId: string, data: EditMessagePayload) =>
    apiClient.patch<ChatMessage>(`/rooms/${roomId}/messages/${messageId}`, data),
  deleteMessage: (roomId: string, messageId: string) =>
    apiClient.delete<ChatMessage>(`/rooms/${roomId}/messages/${messageId}`),
};
