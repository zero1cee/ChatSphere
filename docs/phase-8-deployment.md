# Phase 8 — Redis, production images, and deployment

**Date:** 2026-11-07  
**Scope:** Redis-backed rate limits, presence, Socket.IO pub/sub, production Docker images, Nginx
same-origin routing, readiness checks, and deployment documentation.

## Redis control plane

`REDIS_URL` is optional in tests and required in the production Compose stack.

| Concern               | Implementation                                                                                                        |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Socket.IO fan-out     | `@socket.io/redis-adapter` with dedicated pub/sub clients                                                             |
| Presence              | Redis sets `chatsphere:presence:<userId>` of socket IDs, five-minute TTL, refreshed every two minutes while connected |
| REST rate limits      | `rate-limit-redis` stores with stable per-limiter prefixes                                                            |
| Socket message limits | Redis `INCR` + expiry keyed by user ID, local fallback if Redis errors                                                |
| Readiness             | `/api/health/ready` pings PostgreSQL and Redis when configured                                                        |

Presence updates are still emitted only to co-members. The Redis adapter carries those events between
API instances. On disconnect, the user's socket is removed from the Redis set; the last socket marks
the user offline and persists `lastSeenAt`.

## Production images

### API

- Multi-stage `node:24-alpine` build.
- Installs the frozen pnpm workspace lockfile, builds shared contracts and the API.
- Runtime includes compiled `dist`, Prisma schema/migrations/config, and the Prisma CLI for the
  entrypoint migration.
- `docker/api-entrypoint.sh` applies committed Prisma migrations, then starts `node dist/server.js`.
- Set `RUN_MIGRATIONS=false` when migrations are run as a separate deployment job.

### Web

- Multi-stage Next.js build with `output: 'standalone'`.
- Runtime contains only the standalone server, static assets, and public files.
- Built with empty `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_SOCKET_URL` so the browser uses the current
  origin.

### Composition

`docker-compose.prod.yml` runs:

- PostgreSQL 18.6 with a health check and persistent volume.
- Redis 8.10 with a health check and AOF volume.
- API, web, and Nginx proxy.
- API migrations and readiness checks before web/proxy start.
- Nginx routes `/api` and `/socket.io` to the API and `/` to the web server, including WebSocket
  upgrade headers and a 12 MB request limit.

Production configuration is documented in [deployment.md](deployment.md).

## Verification executed

### Unit/integration/realtime

```text
pnpm test
  12 files passed
  54 tests passed
```

### Playwright

```text
pnpm test:e2e
  2 passed
    - authentication + accessibility
    - two-user realtime collaboration + accessibility
```

The E2E suite was also run with a Redis-backed dev API. Redis rate-limit keys and socket
rate-limit keys were observed, and the online-presence assertion still passed.

Other checks:

- `pnpm lint` — passed, 183 files.
- `pnpm typecheck` — passed for shared, API, and web.
- `pnpm build` — passed; 11 routes; standalone server at `apps/web/.next/standalone/apps/web/server.js`.
- Production images: API 1.57 GB, web 297 MB (the API image includes the Prisma CLI and full
  dependency tree to support entrypoint migrations).

### Cross-instance Socket.IO

Two API instances were started against the same PostgreSQL and Redis:

- API A on port 4000.
- API B on port 4100.
- Ada connected to A; Ben connected to B.
- Both joined the same conversation.
- Ada sent a message through A.
- Ben received it through B.

Result: **received across instances**. Both servers logged the Redis adapter as enabled.

### Production Compose smoke test

- `docker compose ... build` produced `chatsphere-prod-api` and `chatsphere-prod-web`.
- `docker compose ... up -d` started PostgreSQL, Redis, API, web, and Nginx.
- The API entrypoint applied all three migrations.
- `/api/health/ready` returned `200` with `database=up` and `redis=up`.
- Nginx served `/` and `/login` with `200`.
- The Socket.IO polling handshake through Nginx returned a valid session.
- The authentication + accessibility Playwright test passed against `http://localhost:8080` with
  same-origin API calls and cookies.

Local production smoke uses `COOKIE_SECURE=false` over HTTP. A real deployment must use HTTPS and
`COOKIE_SECURE=true`.

## Known limitations

- No public cloud deployment has been performed; this phase validates images and Compose locally.
- Managed PostgreSQL, Redis, S3, and SMTP are deployment-time decisions. The local production smoke
  does not exercise attachment rendering because the local S3Mock endpoint is not browser-resolvable
  from the Compose network; a real S3 endpoint is required.
- API images include the Prisma CLI and full dependency tree to support entrypoint migrations.
  Splitting a dedicated migration image and pruning the runtime image is a follow-up optimization.
- Presence keys expire after five minutes if an instance crashes without cleanup. This intentionally
  bounds stale state; a heartbeat/lease mechanism can tighten it.
- No Redis Cluster/Sentinel configuration, autoscaling policy, centralized observability, or backup
  automation is included.
- Playwright is still local-only and not wired into CI. Docker builds are not part of CI either.

## Next

Public cloud deployment, managed service provisioning, TLS/domain configuration, backup and
observability runbooks, CI image publishing, and load testing.
