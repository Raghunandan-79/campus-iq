# Deployment & Free-Tier Notes

CampusIQ runs fully locally with **zero cloud credentials** (PGlite + local
filesystem). The sections below describe taking it to hosted free tiers.

## Recommended free-tier stack

| Piece | Service | Notes |
|---|---|---|
| Web | Vercel Hobby / Cloudflare Pages | Next.js native; Hobby has commercial-use restrictions — verify current terms |
| API | Render free / Railway trial / Fly.io | Render free spins down after inactivity (cold starts ~30–60s); no persistent disk on free tier — **local file storage will not persist**, use R2 |
| Database | Neon free | 0.5 GB storage, ~190 compute hours/mo; scale-to-zero |
| Storage | Cloudflare R2 free | 10 GB, ~1M Class A + 10M Class B ops/mo, zero egress; overage billed |

## Environment

Backend `.env` (see `apps/backend/.env.example`):

```env
NODE_ENV=production
DATABASE_URL=postgres://...neon...
APP_ORIGIN=https://your-app.vercel.app
SESSION_SECRET=<long random>
STORAGE_PROVIDER=r2
R2_ACCOUNT_ID=...
R2_BUCKET_NAME=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
MAX_UPLOAD_SIZE_MB=20
```

Web: set `BACKEND_URL=https://your-api.onrender.com` (server-side rewrite
target; **not** `NEXT_PUBLIC_*` — the API is never called from the browser
directly, so no API URL or secret ships to the client bundle).

## Honest limitations

- **Render/Railway free tiers sleep** — first request after idle is slow;
  Neon compute also scales to zero. Acceptable for a student MVP, not for
  production SLAs.
- **Vercel Hobby** prohibits commercial use and has bandwidth/build limits.
- **R2 free tier is capped** (10 GB); PDFs are small but monitor usage —
  overages are billed.
- **PGlite is for local dev only** — it's single-connection and not for
  production concurrency.
- No email verification or OAuth is implemented — don't claim otherwise.
  Password reset / email flows are future work.
- Uploaded files on serverless hosts need R2 (ephemeral disks).

## Production checklist

- [ ] `DATABASE_URL` set → migrations auto-run on boot
- [ ] `SESSION_SECRET` is a real random secret (not the dev default)
- [ ] `APP_ORIGIN` = exact web origin (CSRF origin check + CORS)
- [ ] `STORAGE_PROVIDER=r2` + all `R2_*` vars
- [ ] `NODE_ENV=production` (enables `Secure` cookies — requires HTTPS)
- [ ] Seed colleges/subjects intentionally (production data, not demo user)
