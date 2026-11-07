export interface MessageSender {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
}

export interface MessageAttachmentDTO {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  url: string;
}

export interface MessageReactionDTO {
  emoji: string;
  user: {
    id: string;
    name: string;
    username: string;
  };
}

export interface MessageReplyPreviewDTO {
  id: string;
  content: string | null;
  senderId: string;
  senderName: string;
  deletedAt: string | null;
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
  attachments: MessageAttachmentDTO[];
  reactions: MessageReactionDTO[];
  replyTo: MessageReplyPreviewDTO | null;
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
  attachmentCount: number;
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
