# ADR 002 — Local object storage

**Status:** accepted (Phase 2)

## Context

ChatSphere needs S3-compatible storage for avatars and private attachments. MinIO has historically
been the default local choice, but at setup time its public Docker image (`minio/minio`) was no
longer pullable, and the Quay image was not publicly available. The application still needs a
deterministic local S3 endpoint so upload and signed-URL code can be developed and tested.

## Decision

Use **Adobe S3Mock 5.2.3** locally via Docker Compose. The API uses the standard AWS SDK v3 and
only needs an endpoint, region, credentials, and path-style addressing, so production can switch to
Amazon S3 or Cloudflare R2 without code changes.

S3Mock creates two buckets on startup:

- `chatsphere-avatars`
- `chatsphere-attachments`

The local AWS credentials are the S3Mock test credentials (`test` / `test`); they are not secrets
and are only used against the local emulator.

## Trade-offs

- S3Mock accepts presigned URLs but does not validate their signatures or expiry. Local tests can
  verify that the application _issues_ and _uses_ signed URLs, but real expiry/authorization
  enforcement must be verified against a real S3 provider before claiming it works in production.
- S3Mock is an emulator, not a production object store. It is not deployed with the application.
- Production configuration and private-bucket policy will be documented in the deployment phase.

## Alternatives considered

- **MinIO** — preferred if a maintained, publicly pullable image is available again.
- **Garage / SeaweedFS** — capable S3-compatible systems, but more operational configuration for a
  local development loop.
- **LocalStack** — broader emulator surface and a significantly heavier footprint.
- **Cloudinary** — introduces an external account and a different storage API; not necessary for a
  self-hosted S3 design.
