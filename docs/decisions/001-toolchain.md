# ADR 001 — Toolchain and version pins

**Status:** accepted (Phase 2)

## Context

The registry's `latest` tags are not automatically the safest choices for this project. Two
concrete problems surfaced during setup:

1. `prisma`'s `latest` tag points at an 8.0 release candidate while `@prisma/client` remains on
   7.10.1.
2. ESLint 10 is current, but the plugin stack pulled in by `eslint-config-next@16.4.5`
   (`eslint-plugin-import`, `eslint-plugin-react`, `eslint-plugin-jsx-a11y`) only supports ESLint 9.
   ESLint 9 is now formally deprecated by the ESLint project.

## Decisions

### Prisma 7.10.1

Use `prisma@7.10.1` and `@prisma/client@7.10.1` together, plus `@prisma/adapter-pg@7.10.1`. Prisma 7
requires an ESM package, a `prisma.config.ts`, the new `prisma-client` generator with an explicit
output directory, and a driver adapter. The API follows those requirements.

Do not install `prisma@latest` until the 8.x line is stable and its client version matches.

### TypeScript 5.9.3

Keep TypeScript on the 5.9 line while Next 16, Prisma 7, and the surrounding tooling settle around
the new TypeScript 7 compiler. The upgrade will be treated as a separate, verified change rather
than an incidental dependency bump.

### Biome 2.6.5 instead of ESLint + Prettier

Biome provides linting, formatting, import organization, React hooks checks, and accessibility
rules in one supported binary. It avoids the deprecated ESLint 9 / incompatible ESLint 10 split.
The trade-off is that Next-specific lint rules from `eslint-config-next` are not available; `next
build` still runs the framework's type checking and build-time checks.

### pnpm 12.16.1 with explicit native build allow-list

`pnpm-workspace.yaml` allows the install scripts that are genuinely required (`prisma`,
`@prisma/engines`, `esbuild`, `sharp`, `@tailwindcss/oxide`, `unrs-resolver`, `@node-rs/argon2`) and
explicitly blocks `@scarf/scarf` telemetry.

## Consequences

- Dependency upgrades are deliberate and documented, not automatic.
- `pnpm install` may report a minimum-release-age exclusion for the exact pinned Next/Biome
  versions; those entries are maintained in `pnpm-workspace.yaml`.
- Revisit this ADR when Prisma 8, TypeScript 7, and ESLint 10 are all supported by the full stack.
