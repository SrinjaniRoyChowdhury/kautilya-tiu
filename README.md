# Kautilya MUN

Multi-edition Model United Nations platform. Phases 1–2 are live: auth, schema, public site, edition/committee admin, dynamic registration, and capacity locking.

**Budget: ₹0.** Supabase Free (or local CLI) + this Next.js app. No Redis, no paid email, no payment gateway.

## What is built

- Email/password auth with verification and password reset (Supabase Auth)
- Full SRS schema (payments, QR, attendance, food, CMS, audit) ready for later phases
- Public pages: home, about, team, committees, editions, contact
- Admin CRUD: editions and committees
- Participant dashboard, dynamic registration form, committee seat locking
- Docker for the Next.js app; `npx supabase start` Dockerizes Postgres, Auth, Storage, Studio, and Inbucket

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
Inbucket (local emails): http://127.0.0.1:54324  
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

New signups must click the verification link in Inbucket before they can register or pay (Phases 2–3).

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
```

The browser still talks to `127.0.0.1:54321`; the container uses the internal URL.

## Hosted Free (still ₹0)

Create a project at [supabase.com](https://supabase.com) (Free plan). Put the project URL, anon key, and service role key in `.env`. Run the SQL in `supabase/migrations/` in the SQL editor, then `supabase/seed.sql` if you want demo data. Point `NEXT_PUBLIC_APP_URL` at wherever you serve Next.js (college VM, Oracle Always Free, your laptop).

Do not add paid SMTP, Redis, Sentry, or a payment gateway.

## Phase map (SRS §54)

| Phase | Status |
| --- | --- |
| 1 Foundation — auth, schema, editions, committees, public site | Done |
| 2 Registration — dynamic forms, dashboard, capacity locking | This checkout |
| 3 Payments — UPI proof, group pay, admin verify | Next |
| 4 QR | |
| 5 Attendance + food scanners | |
| 6 Admin analytics, CMS, reports | |
| 7 Hardening | |
