# ADR 003 — Database-level messaging constraints

**Status:** accepted (Phase 2)

## Context

Application checks are necessary but not sufficient for a messaging system. Several invariants are
cheap to enforce in PostgreSQL and should not depend on every future endpoint remembering them.

## Decisions

### One direct conversation per pair

`Conversation.directKey` stores the two participant UUIDs in sorted order. A unique constraint on
the column makes the pair unique even under concurrent requests. Creating a direct conversation
handles the unique conflict by returning the existing conversation.

### One owner per group

A partial unique index enforces at most one `OWNER` membership per conversation:

```sql
CREATE UNIQUE INDEX "one_owner_per_conversation"
  ON "ConversationMember" ("conversationId")
  WHERE "role" = 'OWNER';
```

Transferring ownership must therefore revoke the old owner and assign the new one in one
transaction.

### Conversation and message checks

- `DIRECT` conversations require a `directKey`; groups must not have one.
- Groups require a title.
- A message with non-null `content` cannot be empty or whitespace-only.

### Message idempotency

A unique constraint on `(senderId, clientMessageId)` lets a retried socket send return the original
message instead of creating a duplicate. Socket.IO delivery remains at-least-once; the client also
deduplicates by persisted message ID.

## Consequences

- Some operations require multi-statement transactions to satisfy the constraints.
- Prisma cannot express partial indexes or check constraints in `schema.prisma`, so these live in a
  hand-written migration. Any future schema change must preserve them.
- The API must translate Prisma unique violations into the appropriate response rather than
  returning a raw database error.
