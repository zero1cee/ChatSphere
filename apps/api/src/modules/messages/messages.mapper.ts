import type { MessageDTO, MessagePreviewDTO } from '@chatsphere/shared';
import type { Prisma } from '../../generated/prisma/client.js';

interface MessageRecord {
  id: string;
  conversationId: string;
  content: string | null;
  clientMessageId: string;
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
  sender: {
    id: string;
    name: string;
    username: string;
    avatarUrl: string | null;
  };
}

export const messageInclude = {
  sender: {
    select: {
      id: true,
      name: true,
      username: true,
      avatarUrl: true,
    },
  },
} satisfies Prisma.MessageInclude;

export function toMessageDTO(message: MessageRecord): MessageDTO {
  return {
    id: message.id,
    conversationId: message.conversationId,
    sender: {
      id: message.sender.id,
      name: message.sender.name,
      username: message.sender.username,
      avatarUrl: message.sender.avatarUrl,
    },
    content: message.deletedAt ? null : message.content,
    clientMessageId: message.clientMessageId,
    createdAt: message.createdAt.toISOString(),
    editedAt: message.editedAt?.toISOString() ?? null,
    deletedAt: message.deletedAt?.toISOString() ?? null,
  };
}

export function toMessagePreviewDTO(message: MessageDTO): MessagePreviewDTO {
  return {
    id: message.id,
    content: message.content,
    sender: {
      id: message.sender.id,
      name: message.sender.name,
      username: message.sender.username,
    },
    createdAt: message.createdAt,
    deletedAt: message.deletedAt,
  };
}
