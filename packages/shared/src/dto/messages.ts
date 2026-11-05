export interface MessageSender {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
}

export interface MessageDTO {
  id: string;
  conversationId: string;
  sender: MessageSender;
  content: string | null;
  clientMessageId: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
}

export interface MessagePreviewDTO {
  id: string;
  content: string | null;
  sender: {
    id: string;
    name: string;
    username: string;
  };
  createdAt: string;
  deletedAt: string | null;
}

export interface MessageListData {
  messages: MessageDTO[];
}

export interface MessageListMeta {
  hasMore: boolean;
  oldestCursor: string | null;
  newestCursor: string | null;
}

export interface ConversationUpdatedEvent {
  conversationId: string;
  updatedAt: string;
  lastMessage: MessagePreviewDTO | null;
}
