# Production deployment

ChatSphere ships as three containers behind one origin:

```text
Browser ──HTTPS──► Nginx
                    ├── /            → Next.js web (:3000)
                    ├── /api/*       → Express API (:4000)
                    └── /socket.io/* → Socket.IO on the same API (:4000)

API ── Prisma ──► PostgreSQL
    ── Redis ───► rate limits, presence, Socket.IO pub/sub
    ── S3 ──────► attachments (presigned URLs)
    ── SMTP ────► verification/reset email
```

The browser uses relative API URLs and the current origin for Socket.IO, so no CORS
configuration is needed between the web app and API in production. Cookies remain HttpOnly,
SameSite=Lax, and secure when TLS terminates at the proxy.

## Prerequisites

- Docker Engine 29+ with Compose.
- An external PostgreSQL database, or the Compose Postgres service.
- Redis 7+.
- An S3-compatible bucket with public access disabled.
- SMTP credentials.
- A TLS-terminating proxy or load balancer in front of Nginx for HTTPS. The Compose proxy
  publishes HTTP on `HTTP_PORT` for local smoke tests; terminate TLS before exposing it publicly.

## Configuration

```bash
cp .env.production.example .env.production
```

Required values:

| Variable            | Notes                                                     |
| ------------------- | --------------------------------------------------------- |
| `POSTGRES_*`        | Compose Postgres credentials                              |
| `PUBLIC_ORIGIN`     | Exact browser origin, e.g. `https://chat.example.com`     |
| `JWT_ACCESS_SECRET` | At least 32 random characters                             |
| `COOKIE_SECURE`     | `true` with HTTPS                                         |
| `TRUST_PROXY`       | `true` behind Nginx/most load balancers                   |
| `S3_*`              | Bucket, endpoint, region, credentials, path-style setting |
| `SMTP_*`            | Real SMTP credentials                                     |

Never commit `.env.production`. It is ignored by Git and Docker.

## Build and start

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

The API entrypoint runs `prisma migrate deploy` before starting. To run migrations separately:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm \
  -e RUN_MIGRATIONS=false api /app/node_modules/.bin/prisma migrate deploy
```

For a zero-downtime migration, run the migration job before rolling API tasks and set
`RUN_MIGRATIONS=false` on the API tasks.

## Smoke checks

```bash
curl http://localhost:8080/api/health
curl http://localhost:8080/api/health/ready
curl -I http://localhost:8080/
```

`/api/health/ready` checks PostgreSQL and, when `REDIS_URL` is configured, Redis. A `503`
means the deployment should not receive traffic.

Socket.IO handshake:

```bash
curl 'http://localhost:8080/socket.io/?EIO=4&transport=polling'
```

## Operations

- **Migrations:** automatic in the entrypoint, or a separate job via `RUN_MIGRATIONS=false`.
- **Logs:** `docker compose ... logs -f api web proxy`.
- **Backups:** back up PostgreSQL and the S3 bucket; Redis is ephemeral/operational state.
- **Scaling the API:** Redis backs Socket.IO pub/sub, presence, and shared rate limits, so multiple
  API replicas can run behind the proxy. Sticky sessions are not required with the Redis adapter.
- **Health probes:** point readiness at `/api/health/ready`; liveness at `/api/health`.
- **File size:** Nginx is configured for 12 MB requests; the API enforces 10 MB per attachment.
- **TLS:** terminate HTTPS at the edge or extend the proxy with certificates; keep
  `COOKIE_SECURE=true`.
- **Redis outage:** the API fails readiness and rate limits cannot be shared. Treat Redis as a
  required production dependency.

## Local production smoke test

For a local HTTP smoke test, use `PUBLIC_ORIGIN=http://localhost:8080` and
`COOKIE_SECURE=false`. This validates compilation, migrations, proxy routing, health, and login
without requiring public TLS.

The checked-in `.env.production.example` is a placeholder template; the actual `.env.production`
used during local verification is ignored and never committed.
