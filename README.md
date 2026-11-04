# ChatSphere

**ChatSphere** is a real-time messaging platform for direct conversations, focused group chats,
and the small signals that make conversation feel human: presence, typing, delivery and read
receipts.

This is a portfolio project built as a production-style modular monolith — not a tutorial chat
app. It is being built in verified milestones, with the architecture and trade-offs documented as
it grows.

> **Status: Phase 2 — foundation.** The web shell, API, database schema, local infrastructure, and
> CI pipeline are running. Authentication is the next milestone. Nothing in this README claims
> tests or features that do not exist yet. See
> [the Phase 2 verification log](docs/phase-2-foundation.md) for the commands and actual results.

## What works today

- Original responsive landing page with light/dark themes and an accessible design system.
- Express 5 API with validated environment, structured logging, CORS, Helmet, request IDs, consistent
  JSON envelopes, and liveness/readiness checks.
- PostgreSQL 18 schema managed by Prisma 7, with the complete messaging data model and database
  constraints applied through migrations.
- Docker Compose for PostgreSQL, Redis, Mailpit, and an S3-compatible local store (S3Mock).
- pnpm workspace with shared TypeScript contracts and Biome linting/formatting.
- GitHub Actions CI skeleton: install, generate Prisma client, migrate, lint, typecheck, build.

## Not built yet

Authentication, conversations, message sending, Socket.IO, presence, receipts, attachments,
notifications, Playwright E2E tests, and deployment. These are the next phases and will be added
with their tests before being described as complete.

## Screenshots

<p>
  <img src="docs/screenshots/landing-light.png" alt="ChatSphere landing page in light mode" width="49%" />
  <img src="docs/screenshots/landing-dark.png" alt="ChatSphere landing page in dark mode" width="49%" />
</p>
<p align="center">
  <img src="docs/screenshots/landing-mobile.png" alt="ChatSphere landing page on a mobile viewport" width="280" />
</p>

## Stack

| Layer           | Choice                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| Web             | Next.js 16.4.5 (App Router), React 19.3.1, TypeScript 5.9.3, Tailwind CSS 4.3.4, shadcn/ui, next-themes |
| API             | Node.js 24, Express 5.3.0, TypeScript, Zod 4, pino, Helmet, express-rate-limit                          |
| Data            | PostgreSQL 18.6, Prisma 7.10.1 with `@prisma/adapter-pg`                                                |
| Realtime (next) | Socket.IO 4.8.4                                                                                         |
| Local infra     | Docker Compose, Redis 8.10, Mailpit, Adobe S3Mock                                                       |
| Tooling         | pnpm 12.16.1, Biome 2.6.5, GitHub Actions                                                               |

Exact versions and the reasons for the important pins are in
[docs/decisions/001-toolchain.md](docs/decisions/001-toolchain.md).

## Architecture

```text
Browser (Next.js) ── REST ─────► Express API ── Prisma ──► PostgreSQL
        │                            │
        └──────── Socket.IO ─────────┘
                                     ├── Redis (scale phase: adapter, presence, rate limits)
                                     ├── S3-compatible object storage (attachments)
                                     └── SMTP / Mailpit (verification and reset email)
```

PostgreSQL is the source of truth for users, conversations, messages, and receipts. Redis will be
introduced only when the core messaging workflow works and multi-instance delivery requires it.

## Repository layout

```text
chatsphere/
├── apps/
│   ├── api/                 Express API + Prisma schema, migrations, generated client
│   └── web/                 Next.js App Router frontend
├── packages/shared/         Shared API types and (soon) Zod contracts
├── docs/                    Decisions, screenshots, and operational notes
├── docker-compose.yml       Local Postgres, Redis, Mailpit, S3Mock
├── biome.json               Lint + format configuration
└── pnpm-workspace.yaml      Workspace and native build allow-list
```

## Local setup

### Prerequisites

- Node.js 24+
- pnpm 12 via Corepack
- Docker with Compose. On this Mac, the setup uses
  [Colima](https://colima.run) instead of Docker Desktop.

```bash
brew install colima docker docker-compose
colima start --cpu 4 --memory 6 --disk 40 --vm-type vz
```

### First run

From the repository root:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

corepack enable --install-directory "$HOME/.local/bin" pnpm
corepack prepare pnpm@12.16.1 --activate

pnpm install
docker compose up -d
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Open:

- Web: <http://localhost:3000>
- API health: <http://localhost:4000/api/health>
- API readiness (checks PostgreSQL): <http://localhost:4000/api/health/ready>
- Mailpit inbox: <http://localhost:8025>
- S3Mock endpoint: <http://localhost:9090>

### Local services

| Service           | Port        | Purpose                                     |
| ----------------- | ----------- | ------------------------------------------- |
| Web (Next.js)     | 3000        | Frontend                                    |
| API (Express)     | 4000        | REST API (Socket.IO will share this server) |
| PostgreSQL        | 5432        | Persistent application data                 |
| Redis             | 6379        | Reserved for the scaling phase              |
| Mailpit SMTP / UI | 1025 / 8025 | Local email capture                         |
| S3Mock            | 9090        | Local S3-compatible object storage          |

## Common commands

| Command            | What it does                                                   |
| ------------------ | -------------------------------------------------------------- |
| `pnpm dev`         | Build shared contracts, then run API, web, and shared watchers |
| `pnpm build`       | Build shared, API, and web                                     |
| `pnpm lint`        | Biome check (lint, format, imports)                            |
| `pnpm format`      | Apply Biome safe fixes                                         |
| `pnpm typecheck`   | Build shared contracts, then typecheck every package           |
| `pnpm db:generate` | Generate the Prisma client                                     |
| `pnpm db:migrate`  | Create/apply a development migration                           |
| `pnpm db:deploy`   | Apply committed migrations (CI/production)                     |
| `pnpm db:studio`   | Open Prisma Studio                                             |
| `pnpm infra:up`    | Start local infrastructure                                     |
| `pnpm infra:down`  | Stop local infrastructure                                      |

## Technical decisions

- **Prisma 7.10.1 is pinned deliberately.** The npm `latest` tag currently points at an 8.0 release
  candidate; both the CLI and client stay on the stable 7 line.
- **TypeScript 5.9.3 is pinned.** The new TypeScript 7 compiler is not yet the safe default for this
  Next/Prisma/tooling combination; upgrade after a dedicated compatibility check.
- **Biome replaces ESLint + Prettier.** ESLint 10 is incompatible with the plugins loaded by
  `eslint-config-next` 16.4.5, while ESLint 9 is now formally deprecated. Biome provides linting,
  formatting, import organization, and accessibility rules in one supported tool.
- **S3Mock replaces MinIO locally.** The official MinIO Docker image is no longer publicly
  distributed. S3Mock is a local S3 API emulator; production will use S3 or Cloudflare R2. See
  [docs/decisions/002-local-object-storage.md](docs/decisions/002-local-object-storage.md).
- **Direct conversations are protected by a unique `directKey`**, and group ownership by a partial
  unique index. These are enforced in PostgreSQL, not only in application code.

## Database

The initial migration creates: `User`, `Conversation`, `ConversationMember`, `Message`,
`MessageAttachment`, `MessageRead`, `MessageReaction`, `Notification`, `RefreshSession`, and
`VerificationToken`. A second migration adds database-level constraints for direct conversation
keys, group titles, one owner per conversation, and non-blank message content.

```bash
pnpm db:migrate      # development
pnpm db:deploy       # CI / production
pnpm db:studio       # inspect data
```

## Testing

No automated tests exist yet. The CI workflow currently verifies install, Prisma generation,
migrations, linting, type checking, and builds. Test suites arrive with Phase 3 and are not reported
as passing until they are actually executed.

## Roadmap

1. ~~Phase 1 — architecture plan~~ ✅
2. ~~Phase 2 — workspace, infrastructure, schema, API health, web shell, CI~~ ✅
3. Phase 3 — authentication (registration, verification, login, refresh, reset)
4. Phase 4 — users, profiles, direct and group conversations
5. Phase 5 — real-time messaging with Socket.IO
6. Phase 6 — typing, presence, receipts, attachments, notifications, message actions
7. Phase 7 — full unit/integration/realtime/E2E test suites
8. Phase 8 — Redis, Docker production images, deployment, documentation, screenshots

## License

Portfolio project. Please ask before reusing the branding or content.
