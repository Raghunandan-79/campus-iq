# CampusIQ — Local Development

## Prerequisites

- [Bun](https://bun.sh) 1.4+
- Node.js 24+ (for tooling)

No cloud credentials are required for local development.

## Quick start

```bash
bun install

# Terminal 1 — backend API (port 8080)
cd apps/backend
cp .env.example .env   # optional; defaults work out of the box
bun run db:seed        # colleges, subjects, demo user
bun run dev

# Terminal 2 — web app (port 3000)
cd apps/web
bun run dev
```

Open http://localhost:3000

Or from the repo root: `bun run dev` (Turbo runs both apps).

## Demo account

After `bun run db:seed`:

- Email: `demo@campusiq.dev`
- Password: `password123`

## Database

The backend uses **Drizzle ORM** with version-controlled migrations in
`apps/backend/drizzle/`.

- **Default (zero credentials):** embedded [PGlite](https://pglite.dev)
  (Postgres compiled to WASM), data stored in `apps/backend/.pglite/`.
- **Production / shared dev:** set `DATABASE_URL` to a Neon (or any
  Postgres) connection string. Migrations run automatically on boot.

Generate new migrations after schema changes:

```bash
cd apps/backend
bun run db:generate
```

Never run destructive operations against a shared/production database.

## File storage

- `STORAGE_PROVIDER=local` (default): files written under
  `apps/backend/uploads/` (gitignored).
- `STORAGE_PROVIDER=r2`: Cloudflare R2 via the S3-compatible API — see
  `storage.md`.

## Verification commands

```bash
bun run lint          # ESLint across workspaces
bun run check-types   # TypeScript across workspaces
bun run test          # Vitest + Supertest (backend)
bun run build         # Production builds
```

Backend tests use an isolated PGlite dir (`.pglite-test`) and storage dir
(`.uploads-test`), wiped automatically by `tests/globalSetup.ts`.
