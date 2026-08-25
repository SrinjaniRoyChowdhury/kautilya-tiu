# Kautilya MUN

Multi-edition Model United Nations platform. Phases 1–7 are live: conference ops plus hardening (headers, rate limits, tests, backups, health checks).

**Budget: ₹0.** Supabase Free (or local CLI) + this Next.js app. No Redis, no paid email, no payment gateway, no Sentry.

## What is built

- Email/password auth with verification and password reset (Supabase Auth)
- Full SRS schema (payments, QR, attendance, food, CMS, audit)
- Public pages: home, about, team, committees, editions, contact
- Admin CRUD: editions, committees, payment instructions, meal types, CMS copy
- Participant dashboard, dynamic registration form, committee seat locking
- Payments: UPI/bank instructions, screenshot upload, group pay by email, admin verify/reject
- Credentials: opaque QR on confirmation, dashboard credential page, Mailpit delivery, regenerate
- Venue: attendance scan (unique per day), optional check-out, food collect after confirm, offline queue, manual correction
- Admin analytics (edition-scoped KPIs), CSV exports, audit log
- Public CMS: homepage, about, team, contact, announcements, gallery (image URLs)
- Hardening: security headers, auth/scanner/payment rate limits, image magic-byte checks, HTML sanitization, unit tests, GitHub Actions, DB dump script
- Docker for the Next.js app; `npx supabase start` Dockerizes Postgres, Auth, Storage, Studio, and Mailpit

## Run locally (Windows / macOS / Linux)

1. Install Docker Desktop and Node 20.9+.
2. Copy environment:

```bash
cp .env.example .env
```

On PowerShell: `Copy-Item .env.example .env`

3. Start Supabase (pulls Docker images on first run):

```bash
npm run db:start
```

Studio: http://127.0.0.1:54323  
Mailpit (local emails): http://127.0.0.1:54324  
API: http://127.0.0.1:54321

4. Apply schema + seed (first time, or after SQL changes):

```bash
npm run db:reset
```

5. Start the app:

```bash
npm run dev
```

Open http://localhost:3000

### Seed logins (local only)

| Role | Email | Password |
| --- | --- | --- |
| SUPER_ADMIN | admin@kautilya.local | KautilyaAdmin!26 |
| Participant | delegate@kautilya.local | Delegate!26 |

Desk scanners are created in Admin → Scanners (name, email, password). They sign in at `/login` and are sent to `/scan`. Delegates cannot open the scanner.

New signups must click the verification link in Mailpit before they can register or pay (Phases 2–3).

## Dockerize the Next.js app

Supabase is already in Docker via `npm run db:start`. To also run Next.js in Docker:

```bash
npm run compose:up
```

Hot reload:

```bash
npm run compose:dev
```

If Next.js is in Docker and Supabase is on the host, set in `.env`:

```
SUPABASE_INTERNAL_URL=http://host.docker.internal:54321
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
MAILPIT_URL=http://host.docker.internal:54324
```

The browser still talks to `127.0.0.1:54321`; the container uses the internal URL. Credential emails use Mailpit’s HTTP send API (no paid SMTP).

## Hosted Free (still ₹0)

Create a project at [supabase.com](https://supabase.com) (Free plan). Put the project URL, anon key, and service role key in `.env`. Run the SQL in `supabase/migrations/` in the SQL editor, then `supabase/seed.sql` if you want demo data. Point `NEXT_PUBLIC_APP_URL` at wherever you serve Next.js (college VM, Oracle Always Free, your laptop).

Do not add paid SMTP, Redis, Sentry, or a payment gateway. Without `MAILPIT_URL`, credentials still work in `/dashboard/qr`; email stays queued.

Put the app behind HTTPS (Caddy, nginx, or a college reverse proxy). When `NEXT_PUBLIC_APP_URL` starts with `https:`, plain HTTP is redirected (localhost is left alone).

## Tests, health, backups

```bash
npm test
npm run lint
npm run smoke          # needs the app running on :3000
npm run db:backup      # writes backups/kautilya-*.sql (gitignored)
```

- `GET /api/health` — process liveness (Docker healthcheck)
- `GET /api/ready` — database reachability
- Hosted Supabase Free already takes daily backups. A restore drill is: dump with `npm run db:backup`, then `npx supabase db reset` (destroys local data) or `psql $DATABASE_URL -f backups/<file>.sql` on a throwaway database.
- GitHub Actions runs lint, unit tests, and `next build` on push/PR. Passwords stay in bcrypt/argon via Supabase Auth (NFR-SEC-002); this app never logs them.

## Phase map (SRS §54)

| Phase | Status |
| --- | --- |
| 1 Foundation — auth, schema, editions, committees, public site | Done |
| 2 Registration — dynamic forms, dashboard, capacity locking | Done |
| 3 Payments — UPI proof, group pay, admin verify | Done |
| 4 QR — generate, email, validate, regenerate | Done |
| 5 Attendance + food scanners | Done |
| 6 Admin analytics, CMS, reports | Done |
| 7 Hardening | This checkout |
