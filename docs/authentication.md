# Authentication & Sessions

## Mechanism

- **Passwords:** Argon2id (`argon2` package), hashed server-side only.
- **Sessions:** opaque 32-byte random tokens stored **hashed** (SHA-256) in the
  `sessions` table with `expires_at` (default 30 days, `SESSION_TTL_DAYS`).
- **Cookie:** `campusiq_session` — `HttpOnly`, `SameSite=Lax`, `Secure` in
  production, `Path=/`.
- Login always runs an Argon2 verify (dummy hash when user missing) to reduce
  timing signals.

## Flow

1. `POST /api/v1/auth/signup` or `/login` → `Set-Cookie` + user JSON.
2. Browser sends cookie automatically on same-site requests.
3. `optionalAuth` middleware resolves `req.user` for every request;
   `requireAuth` rejects with 401 when absent.
4. `POST /auth/logout` deletes the session row and clears the cookie.

## Same-origin proxying

The Next.js app rewrites `/api/*` → backend. Cookies are scoped to the host
(ports ignored), so the session works across `:3000` → `:8080` without
`SameSite=None` or token-in-localStorage. **Always access the API through the
web origin (`/api/v1/...`)**, never directly from browser code to `:8080`,
unless CORS+credentials are explicitly configured.

## Authorization

- `req.user` is established **only** server-side from the session cookie;
  client-supplied user IDs are never trusted.
- Roles: `student` (default), `moderator`, `admin`. Signup never accepts a
  role; there is no self-serve privilege escalation path.
- Moderation endpoints require `moderator`/`admin`.

## CSRF

- `SameSite=Lax` cookie + an Origin check middleware that rejects
  state-changing requests whose `Origin` header isn't in `APP_ORIGIN`.
- JSON-only mutations (`express.json`); multipart only on the upload route.

## College email domains

`REQUIRE_COLLEGE_EMAIL_DOMAIN=true` enforces that a signup email's domain
matches the selected college's `domain` field. Off by default; fully
configurable, not hardcoded.

## Rate limiting

- Global: `RATE_LIMIT_MAX` req/window (`RATE_LIMIT_WINDOW_MS`, default
  300/min).
- Auth endpoints: `AUTH_RATE_LIMIT_MAX` (default 20/min) to slow credential
  stuffing.
