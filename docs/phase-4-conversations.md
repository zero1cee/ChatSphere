# Phase 4 — Users and conversations verification

**Date:** 2026-11-04  
**Scope:** user search, public profiles, profile/password settings, direct conversations, groups,
roles, membership management, and the conversation workspace.

## Endpoints

| Method | Endpoint                                 | Who                         | Purpose                                |
| ------ | ---------------------------------------- | --------------------------- | -------------------------------------- |
| GET    | `/api/users/search?q=`                   | Verified member             | Search verified users by name/username |
| GET    | `/api/users/:id`                         | Verified member             | Public profile (no email)              |
| PATCH  | `/api/users/me`                          | Authenticated               | Update name, username, bio             |
| POST   | `/api/users/me/password`                 | Authenticated               | Change password, revoke other sessions |
| GET    | `/api/conversations`                     | Verified member             | Conversations visible to the caller    |
| POST   | `/api/conversations`                     | Verified member             | Create a direct or group conversation  |
| GET    | `/api/conversations/:id`                 | Member                      | Conversation details and members       |
| PATCH  | `/api/conversations/:id`                 | Group owner/admin           | Rename a group                         |
| DELETE | `/api/conversations/:id`                 | Direct member / group owner | Hide a direct chat / delete a group    |
| POST   | `/api/conversations/:id/members`         | Group owner/admin           | Add members                            |
| PATCH  | `/api/conversations/:id/members/:userId` | Group owner                 | Promote, demote, or transfer ownership |
| DELETE | `/api/conversations/:id/members/:userId` | Group owner/admin or self   | Remove a member / leave                |

## Permission rules

| Action             | Owner                         | Admin        | Member |
| ------------------ | ----------------------------- | ------------ | ------ |
| Rename group       | ✅                            | ✅           | ❌     |
| Add members        | ✅                            | ✅           | ❌     |
| Remove member      | ✅                            | Members only | ❌     |
| Promote/demote     | ✅                            | ❌           | ❌     |
| Transfer ownership | ✅                            | ❌           | ❌     |
| Delete group       | ✅                            | ❌           | ❌     |
| Leave group        | ❌ (transfer or delete first) | ✅           | ✅     |
| Read/send (future) | ✅                            | ✅           | ✅     |

- Direct conversations have exactly two members and no member-management endpoints.
- Group size is capped at **50**.
- Non-members receive `404` for conversation detail/mutations, avoiding existence leaks.
- A direct conversation is hidden per user through `ConversationMember.hiddenAt`; the other
  participant keeps their history. Starting the chat again un-hides the same conversation.

## Database decisions

- `Conversation.directKey` is the sorted participant pair with a unique index, making duplicate
  direct conversations impossible under concurrency.
- `@@unique([conversationId, userId])` prevents duplicate membership.
- A partial unique index allows at most one `OWNER` per conversation.
- `pg_trgm` GIN indexes support case-insensitive `ILIKE '%query%'` user search.
- Members are ordered by role, join time, and name in API responses so ownership is stable in the UI.

## Verification executed

```text
pnpm test
  7 files passed
  34 tests passed
    - auth: 13
    - users/profiles/password: 6
    - conversations/permissions: 5
    - unit: 10
```

The conversation integration suite covers direct deduplication, reverse-request reuse, hiding and
reopening, group creation, role enforcement, admin restrictions, ownership transfer, owner leave
prevention, member leave, group deletion, invalid members, duplicate members, and non-member access.

A manual Playwright browser pass verified:

- Login → `/chats` with the conversation list and empty state.
- New direct conversation → conversation screen.
- New group with two selected members → group screen.
- Group details with owner/admin controls.
- Profile bio update on `/settings`.
- No browser page errors during the flow.

Other checks:

- `pnpm lint` — passed.
- `pnpm typecheck` — passed for shared, API, and web.
- `pnpm build` — passed with the conversation routes.

## Known limitations / deferred work

- Avatar uploads are deferred to the file-storage phase; the UI uses initials until then.
- Conversation/membership changes do not yet arrive in real time; Socket.IO is Phase 5. Other users
  see changes after refetching.
- The conversation list is not paginated yet. At current scale it fetches the caller's visible
  conversations in one request; pagination will be added with the messaging UI if needed.
- Destructive actions use native confirmation dialogs. An accessible AlertDialog is a polish item.
- Group membership notifications ("you were added") arrive with the notification system.
- No blocking, muting, or reporting features yet.

## Next

Phase 5 adds the Socket.IO server, authenticated rooms, persisted message sending with
acknowledgements and deduplication, conversation history pagination, reconnect catch-up, and the
message composer.
