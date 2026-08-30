# Niti Sabha

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
- Docker Compose for the full local stack (Supabase + Next.js hot reload)

## Run locally (Windows / macOS / Linux)

1. Install Docker Desktop and Node 20.9+.
2. Copy environment:

```bash
cp .env.example .env
```

On PowerShell: `Copy-Item .env.example .env`

3. Start the full stack (Supabase + Next.js; pulls images on first run):

```bash
docker compose up --build
```

Open http://localhost:3000  
Studio: http://127.0.0.1:54323  
Mailpit (local emails): http://127.0.0.1:54324  
API: http://127.0.0.1:54321

Stop everything (database data is preserved in Supabase Docker volumes):

```bash
docker compose down
```

To wipe local database data intentionally: `npx supabase stop --no-backup` (destroys volumes), then `docker compose up --build`.

### App on the host (optional)

If you prefer `npm run dev` on the host, start only Supabase with `npm run db:start`, apply schema with `npm run db:reset` (first time or after SQL changes), then `npm run dev`.

### Seed logins (local only)

| Role | Email | Password |
| --- | --- | --- |
| SUPER_ADMIN | admin@kautilya.local | KautilyaAdmin!26 |
| Participant | delegate@kautilya.local | Delegate!26 |

Desk scanners are created in Admin → Scanners (name, email, password). They sign in at `/login` and are sent to `/scan`. Delegates cannot open the scanner.

New signups must click the verification link in Mailpit before they can register or pay (Phases 2–3).

## Docker Compose

`docker compose up --build` starts Supabase and the Next.js dev server. `docker compose down` stops both and **keeps your local database** (uses `supabase stop`, not `--no-backup`).

Production-style image only (hosted Supabase):

```bash
npm run compose:prod
```

When Next.js runs in Docker, set in `.env`:

```
SUPABASE_INTERNAL_URL=http://host.docker.internal:54321
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
MAILPIT_URL=http://host.docker.internal:54324
```

The browser still talks to `127.0.0.1:54321`; the container uses the internal URL. Credential emails use Mailpit’s HTTP send API (no paid SMTP).

## Hosted Free / Oracle

See **[DEPLOY.md](./DEPLOY.md)** for the full go-live guide (Supabase Free, Brevo, Oracle VM, DNS, CI → main deploy, superadmin bootstrap).

Quick production shape:

- App: `docker compose --profile prod up -d --build app-prod` on Oracle  
- DB/Auth: hosted Supabase Free  
- Mail: Brevo (Supabase SMTP for auth + `BREVO_API_KEY` for QR emails)  
- CI gates PRs; deploy workflow ships `main` only  

## Hosted Free (still ₹0) — short note

Create a project at [supabase.com](https://supabase.com) (Free plan). Put the project URL, anon key, and service role key in `.env`. Run the SQL in `supabase/migrations/` in the SQL editor. Point `NEXT_PUBLIC_APP_URL` at `https://technokautilya.in`. Do **not** run local seed passwords in production — use `npm run bootstrap:admin` once on the server.

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
