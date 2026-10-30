export interface ChatSender {
  id: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
  sender: ChatSender;
}

export interface ChatMessagesResponse {
  messages: ChatMessage[];
  nextCursor?: string | null;
}

export interface SendMessagePayload {
  content: string;
}

export interface EditMessagePayload {
  content: string;
}
