# Phase 7 — Realtime verification and hardening

**Date:** 2026-11-07  
**Scope:** automated two-user realtime E2E, accessibility enforcement, rate-limit and upload-limit
tests, performance cleanup, and final regression checks.

## Automated E2E coverage

The Playwright suite now has two tests:

1. **Authentication and accessibility** — register through the real UI, verify through Mailpit,
   sign in, sign out, sign in again. Axe checks run on:
   - landing page
   - login page
   - authenticated workspace
2. **Two-user realtime collaboration** — creates two verified users through the public API, opens
   two independent browser contexts, and exercises:
   - direct-conversation creation via user search
   - online presence
   - typing indicator
   - live message delivery
   - read receipt
   - emoji reaction
   - reply with quoted context
   - inline edit
   - image attachment upload through S3Mock
   - soft delete
   - notification badge, notification dialog, and navigation back to the conversation
   - axe checks on the conversation and notification dialog

No test-only API or backdoor was added. Users are created with the real registration endpoint and
verified through the real Mailpit email flow.

## Accessibility

Automated axe checks use WCAG 2 A/AA tags and fail on `serious` or `critical` violations.

Fixes made during Phase 7:

- Landing-page preview avatar and footer contrast.
- Auth-panel footnote contrast.
- User avatar initials changed to foreground text on the tinted avatar background.
- Hidden attachment file input received an accessible label.

The final checks pass on landing, login, workspace, conversation, and notification dialog.

This is automated coverage, not a substitute for manual screen-reader testing.

## Failure and edge-case hardening

New tests cover:

- **Per-socket message rate limit:** the 21st rapid send is rejected with `RATE_LIMITED`.
- **Oversized attachment:** files over 10 MB are rejected with `UPLOAD_INVALID`.
- **Unsupported attachment MIME:** rejected with `UNSUPPORTED_FILE_TYPE`.
- **Unauthenticated upload:** rejected with `401`.
- **Duplicate sends, revoked sessions, reconnect/rejoin, non-member joins** remain covered from
  earlier phases.

Failure paths that still return errors keep the existing JSON envelope with a stable code and
human-readable message.

## Performance and reliability cleanup

- Notification creation now uses a batched `createManyAndReturn` insert instead of one insert per
  recipient.
- Presence connection setup resolves co-members once, then broadcasts presence and sends the
  snapshot sequentially.
- Attachment image loading is handled by a resize observer so newly loaded images do not leave the
  thread scrolled above the newest message.
- The test suite runs files sequentially against the shared test database and truncates before each
  test.
- The client catches up on reconnect by invalidating conversation/message queries and rejoining the
  active conversation.

## Verification

```text
pnpm test
  12 files passed
  54 tests passed
    - auth: 13
    - users/profiles/password: 6
    - conversations/permissions: 5
    - message history/pagination: 4
    - message actions: 4
    - realtime messaging: 4
    - presence/typing/receipts/notifications/rate limit: 5
    - attachment upload/claiming/limits: 3
    - unit: 10

pnpm test:e2e
  2 passed
    - authentication + accessibility
    - two-user realtime collaboration + accessibility
```

Other checks:

- `pnpm lint` — passed, 178 files.
- `pnpm typecheck` — passed for shared, API, and web.
- `pnpm build` — passed; 11 routes.
- Local API readiness, Socket.IO handshake, Mailpit, S3Mock, PostgreSQL, and Redis were running.

## Known limitations

- Playwright is local-only; CI still runs the 54 Vitest tests but not E2E.
- E2E requires a running dev stack, Mailpit, and S3Mock, and repeated runs are subject to the real
  registration rate limit.
- Axe covers automated accessibility checks only; manual keyboard and screen-reader review is still
  required for a release sign-off.
- Presence, typing state, and rate limits remain in-memory for a single API instance.
- Email/push notifications, avatar uploads, attachment malware scanning/orphan cleanup, message
  search, and moderation audit logs remain deferred.
- The upstream `pg` adapter emits a non-fatal concurrent-query deprecation warning during Prisma
  transaction tests; it does not affect test results and is pinned to the current Prisma/pg line.

## Next

Phase 8: Redis-backed presence/rate limits and Socket.IO adapter, production Docker images, deployment
configuration, and final operational documentation.
