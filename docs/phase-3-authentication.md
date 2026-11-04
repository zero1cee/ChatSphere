# Phase 3 — Authentication verification

**Date:** 2026-11-04  
**Scope:** registration, email verification, login, refresh rotation, logout, password reset,
protected routes, first unit/integration/E2E tests.

## Endpoints

| Method | Endpoint                        | Notes                                                                     |
| ------ | ------------------------------- | ------------------------------------------------------------------------- |
| POST   | `/api/auth/register`            | Creates user + verification token + refresh session, sets HttpOnly cookie |
| POST   | `/api/auth/login`               | Argon2id verification, generic failure message, sets refresh cookie       |
| POST   | `/api/auth/refresh`             | Rotates the opaque refresh token; reuse revokes the session family        |
| POST   | `/api/auth/logout`              | Revokes the current refresh session and clears the cookie                 |
| POST   | `/api/auth/verify-email`        | Consumes a single-use, hashed verification token                          |
| POST   | `/api/auth/resend-verification` | Always `202`; invalidates older unused verification tokens                |
| POST   | `/api/auth/forgot-password`     | Always `202`; sends a one-hour reset link when the account exists         |
| POST   | `/api/auth/reset-password`      | Hashes the new password and revokes every existing session                |
| GET    | `/api/users/me`                 | Requires a valid bearer access token                                      |

## Implemented security properties

- Argon2id hashing with 19 MiB memory, 2 passes, 1 lane.
- Access tokens: HS256 JWT, 15-minute default TTL, `iss`/`aud` checked, `sub` + `sid` claims.
- Refresh tokens: 43-character opaque values; only SHA-256 hashes reach PostgreSQL.
- Refresh rotation in a conditional transaction. Reusing a rotated token revokes the whole family.
- Refresh cookie: `HttpOnly`, `SameSite=Lax`, `Secure` in production, `Path=/api/auth`.
- Multi-tab refresh serialisation with the Web Locks API on the client.
- Verification/reset tokens are hashed, single-use, and expire (24h / 1h by default).
- Email enumeration resistance on forgot-password and resend-verification.
- Registration and login rate limits; cookie endpoints also check `Origin`.
- Constant-work login for unknown emails via a cached dummy Argon2 verification.
- Zod validation shared by the API and the browser forms.
- The access token lives only in memory; no auth tokens in `localStorage`.

## Verification executed

```text
pnpm test
  5 test files passed
  23 tests passed

pnpm test:e2e
  1 Playwright test passed
  register → read real Mailpit email → verify → enter /chats → sign out → sign in
```

Manual checks also exercised registration, Mailpit delivery, verification, `/users/me`, refresh,
logout, and refresh-after-logout against the running API.

Other checks:

- `pnpm lint` — passed.
- `pnpm typecheck` — passed for shared, API, and web.
- `pnpm build` — passed (Next.js production build).
- Refresh rotation/reuse, family revocation, reset session revocation, duplicate registration,
  validation failures, wrong passwords, invalid tokens, and untrusted origins are covered by tests.

## Not yet verified / known limitations

- Rate-limit thresholds are not load-tested; the store is in-memory and will move to Redis in the
  scaling phase.
- Real SMTP providers are not tested; Mailpit is the local transport.
- Access tokens remain stateless for their 15-minute lifetime. Logout revokes the refresh session
  and clears the cookie; forcing an immediate socket disconnect is part of the realtime phase.
- Playwright is not yet part of CI; it runs locally against the dev stack and Mailpit.
- There is no account/session management screen or "sign out everywhere" UI yet.
- Email verification currently gates the app shell; server-side `requireVerifiedEmail` is ready for
  Phase 4 conversation endpoints.

## Next

Phase 4 adds user search, public profiles, direct conversations with a unique pair key, group
conversations, roles, and membership authorisation — all server-enforced and tested.
