import { prisma } from '../../src/lib/prisma.js';

export async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "RefreshSession",
      "VerificationToken",
      "Notification",
      "MessageRead",
      "MessageReaction",
      "MessageAttachment",
      "Message",
      "ConversationMember",
      "Conversation",
      "User"
    CASCADE;
  `);
}
