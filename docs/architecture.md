# CampusIQ Architecture

## Monorepo layout

```
campusiq/
├── apps/
│   ├── web/        # Next.js 16 (App Router, React 19, Tailwind v4)
│   ├── backend/    # Express + TypeScript API (Bun runtime)
│   ├── docs/       # create-turbo docs starter (unchanged)
│   └── mobile/     # reserved for future React Native app
├── packages/
│   ├── ui/               # shared UI primitives (scaffold)
│   ├── eslint-config/    # shared ESLint configs
│   └── typescript-config # shared tsconfig bases
├── docs/           # this documentation
└── turbo.json      # Turborepo task graph
```

## Request flow

```
Browser ──> Next.js (apps/web, :3000)
              │  /api/* rewritten server-side to backend
              ▼
           Express API (apps/backend, :8080)
              │  Drizzle ORM
              ▼
        PostgreSQL (Neon) or PGlite (embedded, local dev)
              │
              ▼
        Storage: local FS (dev) or Cloudflare R2 (prod)
```

Next.js **never** talks to the database directly. All data flows through the
versioned REST API at `/api/v1`.

## API proxying (same-origin cookies)

`apps/web/next.config.js` rewrites `/api/:path*` to
`$BACKEND_URL/api/:path*` (default `http://localhost:8080`). Because cookies
ignore ports, the HttpOnly session cookie set by the API is stored for
`localhost` and sent on same-origin requests to `:3000`, which are then
proxied to the backend. This avoids cross-site cookie issues entirely and
keeps tokens out of `localStorage`.

## Backend module layout

```
apps/backend/src/
├── app.ts / server.ts     # Express wiring, graceful boot
├── config/env.ts          # Zod-validated environment
├── db/                    # Drizzle schema + driver selection
│   ├── schema.ts
│   ├── index.ts           # Postgres.js (Neon) or PGlite (local)
│   └── seed.ts
├── middleware/            # auth (sessions), validation, errors
├── modules/               # domain routers
│   ├── auth/              # signup, login, logout, me
│   ├── users/             # profile, my resources/bookmarks/reviews
│   ├── colleges/          # directory, detail, aggregates, moderation
│   ├── college-reviews/   # (router exported from colleges module)
│   ├── subjects/
│   ├── resources/         # CRUD, upload, download, votes, reviews
│   ├── reviews/           # single-review ops (edit/delete/vote/report)
│   ├── bookmarks/
│   └── health/
├── storage/               # StorageProvider interface + local/R2
└── utils/                 # errors, http helpers, logger
```

## Key design decisions

- **Sessions:** opaque random tokens (32 bytes), stored SHA-256-hashed in the
  `sessions` table, delivered in an HttpOnly `SameSite=Lax` cookie. No JWT in
  browser storage.
- **Passwords:** Argon2id via `argon2`.
- **Validation:** Zod schemas per module; consistent `{data}` / `{error}`
  envelopes.
- **Visibility:** enforced in SQL (`visibilityCondition`) — campus-wide by
  default, college-only, restricted (staff/owner).
- **Votes:** single-row-per-(target,user) unique constraint; POST toggles
  (same vote removes it), DELETE removes; all mutations transactional.
- **College reviews:** one row per (college,user) via unique index; rating
  aggregates computed live from `visible` rows only.
- **File safety:** server-generated storage keys, extension + MIME + PDF
  magic-byte checks, multer memory storage, atomic temp-file rename for
  local provider, orphan cleanup on DB failure.

## Frontend architecture

- Server Components where possible; interactive pages are Client Components.
- `@tanstack/react-query` for all remote state; `lib/api.ts` is the typed API
  client; `lib/auth.tsx` provides `useAuth()`.
- `components/ui/*` — small shadcn-style primitives (Button, Input, Card,
  Badge, Skeleton…) styled with the CampusIQ palette.
- Protected pages use `<RequireAuth>` which redirects to `/auth/sign-in`.
