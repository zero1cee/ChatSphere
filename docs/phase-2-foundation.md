# Phase 2 — Foundation verification

**Date:** 2026-11-04  
**Scope:** workspace setup, local infrastructure, database schema, API health layer, web shell,
linting/formatting, CI skeleton.

## What was built

- pnpm workspace with `apps/web`, `apps/api`, and `packages/shared`.
- Node 24.16.0, pnpm 12.16.1 via Corepack, TypeScript 5.9.3, Biome 2.6.5.
- Next.js 16.4.5 App Router app with Tailwind CSS 4, shadcn/ui, light/dark themes, and an original
  responsive landing page.
- Express 5.3.0 API with Zod-validated environment, pino request logging, Helmet, CORS, request IDs,
  consistent success/error envelopes, and `/api/health` + `/api/health/ready`.
- Prisma 7.10.1 with PostgreSQL 18.6, the complete initial messaging schema, and a second migration
  for database-level constraints.
- Docker Compose: PostgreSQL, Redis, Mailpit, and Adobe S3Mock.
- GitHub Actions workflow for install, Prisma generation, migrations, lint, typecheck, and build.

## Commands executed and results

| Check               | Command                            | Result                                              |
| ------------------- | ---------------------------------- | --------------------------------------------------- |
| Frozen install      | `pnpm install --frozen-lockfile`   | Passed, 801 lockfile entries                        |
| Lint/format         | `pnpm lint`                        | Passed                                              |
| Format only         | `pnpm format:check`                | Passed                                              |
| Typecheck           | `pnpm typecheck`                   | Passed for shared, API, and web                     |
| Production build    | `pnpm build`                       | Passed; Next routes `/`, `/_not-found`, `/icon.svg` |
| API liveness        | `curl /api/health`                 | `200`, `status: "ok"`                               |
| API readiness       | `curl /api/health/ready`           | `200`, `database: "up"`                             |
| Database migrations | `prisma migrate status`            | 2 migrations, up to date                            |
| Compiled API        | `node dist/server.js` on port 4001 | Health + readiness `200`; graceful SIGTERM          |
| Compose config      | `docker compose config --quiet`    | Valid                                               |
| Services            | `docker compose ps`                | Postgres, Redis, Mailpit healthy; S3Mock running    |

Database constraints verified directly in PostgreSQL:

- `one_owner_per_conversation`
- `direct_conversation_requires_key`
- `group_requires_title`
- `message_content_not_blank`

## What is intentionally not verified

- There are no unit, integration, realtime, or Playwright tests yet. No test result is claimed.
- The GitHub Actions workflow has not run on GitHub; the equivalent local commands passed.
- S3Mock accepts presigned URLs but does not validate signatures/expiry. Production S3 behaviour
  must be verified against a real provider.
- Authentication, conversations, messaging, Socket.IO, presence, receipts, attachments, and
  notifications are Phase 3+ work.

## Local URLs

- Web: <http://localhost:3000>
- API: <http://localhost:4000/api/health>
- Mailpit: <http://localhost:8025>
- S3Mock: <http://localhost:9090>

## Next

Phase 3 implements registration, email verification (through Mailpit), login, refresh rotation,
logout, password reset, protected routes, and the first real test suites.
