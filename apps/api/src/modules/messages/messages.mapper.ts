import type {
  MessageAttachmentDTO,
  MessageDTO,
  MessagePreviewDTO,
  MessageReactionDTO,
  MessageReplyPreviewDTO,
} from '@chatsphere/shared';
import type { Prisma } from '../../generated/prisma/client.js';

import { getAttachmentUrl } from '../../lib/storage.js';

interface AttachmentRecord {
  id: string;
  storageKey: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

interface ReactionRecord {
  emoji: string;
  user: {
    id: string;
    name: string;
    username: string;
  };
}

interface ReplyRecord {
  id: string;
  content: string | null;
  deletedAt: Date | null;
  sender: {
    id: string;
    name: string;
  };
}

export interface MessageRecord {
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
  attachments: AttachmentRecord[];
  reactions: ReactionRecord[];
  replyTo: ReplyRecord | null;
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
  attachments: {
    select: {
      id: true,
      storageKey: true,
      fileName: true,
      mimeType: true,
      fileSize: true,
    },
    orderBy: { createdAt: 'asc' },
  },
  reactions: {
    include: {
      user: {
        select: {
          id: true,
          name: true,
          username: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
  replyTo: {
    select: {
      id: true,
      content: true,
      deletedAt: true,
      sender: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
} satisfies Prisma.MessageInclude;

async function toAttachmentDTO(attachment: AttachmentRecord): Promise<MessageAttachmentDTO> {
  return {
    id: attachment.id,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    fileSize: attachment.fileSize,
    url: await getAttachmentUrl(attachment.storageKey),
  };
}

function toReactionDTO(reaction: ReactionRecord): MessageReactionDTO {
  return {
    emoji: reaction.emoji,
    user: {
      id: reaction.user.id,
      name: reaction.user.name,
      username: reaction.user.username,
    },
  };
}

function toReplyPreview(reply: ReplyRecord): MessageReplyPreviewDTO {
  return {
    id: reply.id,
    content: reply.deletedAt ? null : reply.content,
    senderId: reply.sender.id,
    senderName: reply.sender.name,
    deletedAt: reply.deletedAt?.toISOString() ?? null,
  };
}

export async function toMessageDTO(message: MessageRecord): Promise<MessageDTO> {
  const deleted = Boolean(message.deletedAt);
  const attachments = deleted ? [] : await Promise.all(message.attachments.map(toAttachmentDTO));

  return {
    id: message.id,
    conversationId: message.conversationId,
    sender: {
      id: message.sender.id,
      name: message.sender.name,
      username: message.sender.username,
      avatarUrl: message.sender.avatarUrl,
    },
    content: deleted ? null : message.content,
    clientMessageId: message.clientMessageId,
    createdAt: message.createdAt.toISOString(),
    editedAt: message.editedAt?.toISOString() ?? null,
    deletedAt: message.deletedAt?.toISOString() ?? null,
    attachments,
    reactions: deleted ? [] : message.reactions.map(toReactionDTO),
    replyTo: message.replyTo ? toReplyPreview(message.replyTo) : null,
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
    attachmentCount: message.attachments.length,
  };
}
