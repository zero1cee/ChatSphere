-- Enforce exactly one OWNER per conversation. PostgreSQL partial unique
-- indexes are not expressible in the Prisma schema, so they live here.
CREATE UNIQUE INDEX "one_owner_per_conversation"
  ON "ConversationMember" ("conversationId")
  WHERE "role" = 'OWNER';

-- DIRECT conversations must have a canonical directKey; GROUP conversations
-- must not. The application computes the key from the two participant IDs.
ALTER TABLE "Conversation"
  ADD CONSTRAINT "direct_conversation_requires_key"
  CHECK (("type" = 'DIRECT') = ("directKey" IS NOT NULL));

ALTER TABLE "Conversation"
  ADD CONSTRAINT "group_requires_title"
  CHECK ("type" <> 'GROUP' OR "title" IS NOT NULL);

-- Empty messages are rejected in the service layer as well; this keeps
-- whitespace-only content out of the table even if a future caller forgets.
ALTER TABLE "Message"
  ADD CONSTRAINT "message_content_not_blank"
  CHECK ("content" IS NULL OR char_length(btrim("content")) > 0);
