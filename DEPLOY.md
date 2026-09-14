# Production go-live guide — Niti Sabha / technokautilya.in
#
# Model:
#   main     → Vercel Production + hosted Supabase (real backend)
#   staging  → Vercel Preview only (no separate database)
# GitHub Actions: CI on PRs/pushes; migrate applies SQL only on main.
# Require Vercel Production Deployment Checks: ci / check + migrate / apply.

## Critical release rule (do not skip)

**On `main`, migrations must land on hosted Supabase before (or gated ahead of) production app traffic.**

1. Merge / push to `main`
2. GitHub Action **migrate** applies pending files in `supabase/migrations/` to production Supabase
3. Vercel Production deploys only after **migrate / apply** succeeds (Deployment Check)
4. Never run `supabase/seed.sql` on hosted Supabase

`staging` is a Vercel preview of the frontend against the same env you configure for previews. It does **not** get its own Supabase project and must **not** run production migrations.

If you deploy app code to production without the new migrations, registration/payment RPCs will fail.

### New migrations in this release (must reach production Supabase)

| File | Purpose |
|------|---------|
| `20260914230000_registration_preferences_allocation.sql` | Prefer 2–3 committees, allocate-before-pay, portfolio matrix URL |
| `20260915001500_fix_phase_activation.sql` | Fix phase switch unique-index error |
| `20260915010000_preserve_submitted_with_fee.sql` | Keep existing SUBMITTED+fee delegates payable after cutover |
| `20260915020000_conference_doc_links.sql` | Rulebook/guidelines stored as CMS links instead of PDF uploads |

---

## Superadmin username / password (live)

**Do not put the password in git, `.env.example`, or GitHub Actions logs.**

Create the first admin once after hosted Supabase is connected (run from your laptop with production env loaded):

```bash
cp .env.production.example .env.production
# fill .env.production with hosted Supabase + Brevo values

export BOOTSTRAP_ADMIN_EMAIL='you@yourdomain.com'   # real inbox you control
export BOOTSTRAP_ADMIN_PASSWORD='long-random-secret' # ≥12 chars
export BOOTSTRAP_ADMIN_NAME='Secretariat'
npm run bootstrap:admin:prod
```

That script uses `SUPABASE_SERVICE_ROLE_KEY` from `.env.production` to:

1. Create (or update) the Auth user  
2. Upsert `public.users`  
3. Grant the `SUPER_ADMIN` role  

Then sign in at `https://technokautilya.in/login`.

Optional: set `PROTECTED_ADMIN_EMAILS=you@yourdomain.com` in Vercel env so that account cannot be deleted via the admin UI.

Local seed accounts (`admin@kautilya.local`) are **local only** — do not rely on them in production.

---

## 1. Hosted Supabase (production backend)

1. Create a project at https://supabase.com  
2. **Settings → API**: copy Project URL, `anon` key, `service_role` key  
3. **Settings → Database**: copy connection string  
   - For **migrations**, prefer the **direct** connection on port **5432** (session). Port **6543** (transaction pooler) often fails DDL.  
   - Store as `DATABASE_URL` in local `.env.production` and as GitHub secret `PRODUCTION_DATABASE_URL`  
4. Apply schema (pick one):  
   - **Preferred:** push/merge to `main` → workflow `.github/workflows/migrate.yml`  
   - **Manual from laptop:** `npm run db:push:prod`  
   - **SQL editor:** run each file in `supabase/migrations/` in filename order  
5. **Do not** run `supabase/seed.sql` in production (demo passwords)  
6. **Authentication → URL configuration**  
   - Site URL: `https://technokautilya.in`  
   - Redirect URLs: `https://technokautilya.in/**`  
7. **Authentication → Providers**: Email enabled  
8. Storage buckets (`payment-proofs`, `cms-media`, `conference-docs`) are created by migrations — confirm they exist  

---

## 2. Brevo (mail)

### A) Auth emails (signup / reset) — Supabase SMTP

1. Brevo → SMTP & API → SMTP  
2. Supabase → Project Settings → Authentication → SMTP Settings  
   - Host: `smtp-relay.brevo.com`  
   - Port: `587`  
   - User / password: from Brevo  
   - Sender: e.g. `noreply@technokautilya.in` (must be verified in Brevo)  

### B) QR credential emails — app

Set these in **Vercel → Project → Settings → Environment Variables** (see `.env.production.example`):

```
BREVO_API_KEY=xkeysib-...
MAIL_FROM=noreply@technokautilya.in
MAIL_FROM_NAME=Niti Sabha
```

Leave `MAILPIT_URL` empty in production.

Add SPF/DKIM DNS records from Brevo for `technokautilya.in` (GoDaddy DNS).

---

## 3. Vercel (app hosting)

1. Import this GitHub repo at https://vercel.com/new  
2. Framework preset: **Next.js** (auto-detected)  
3. Production branch: **`main`**  
4. `staging` (and other branches) → Preview deployments only  
5. Add environment variables for **Production** (copy from `.env.production.example`):

| Variable | Notes |
|----------|--------|
| `NEXT_PUBLIC_APP_URL` | `https://technokautilya.in` |
| `NEXT_PUBLIC_SUPABASE_URL` | Hosted Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only; never expose to client |
| `BREVO_API_KEY` | QR credential emails |
| `MAIL_FROM` | Verified Brevo sender |
| `MAIL_FROM_NAME` | Display name |
| `PROTECTED_ADMIN_EMAILS` | optional |
| `MAILPIT_URL` | leave **empty** |
| `SUPABASE_INTERNAL_URL` | leave **empty** |

`DATABASE_URL` is **not** required on Vercel. Migrations run from GitHub Actions on `main` (or your laptop), not from the Next.js build.

6. Deploy once from the Vercel dashboard (or push to `main` after connecting the repo).

7. **Settings → Domains**: add `technokautilya.in` and `www.technokautilya.in`. Vercel shows the DNS records to add at GoDaddy.

8. **Required for Production (`main`) — wait for migrations before traffic:**  
   **Settings → Git → Deployment Checks** → require:  
   - `ci / check`  
   - `migrate / apply`  

   Do **not** require `migrate / apply` for Preview/`staging` — that workflow only runs on `main`.

9. Bootstrap superadmin (section above).

10. Smoke test:

```bash
curl -fsS https://technokautilya.in/api/health
```

---

## 4. GoDaddy DNS

| Type | Name | Value |
|------|------|-------|
| A / CNAME | @ | Vercel apex record (shown in Vercel Domains) |
| CNAME | www | `cname.vercel-dns.com` (or value Vercel shows) |
| TXT | @ | Brevo SPF (as shown in Brevo) |
| CNAME / TXT | (Brevo DKIM) | as shown in Brevo |

Wait for DNS propagation, then open `https://technokautilya.in`.

---

## 5. GitHub: CI + migrate

### Secrets (Settings → Secrets and variables → Actions)

| Secret | Used when |
|--------|-----------|
| `PRODUCTION_DATABASE_URL` | push to `main` / manual migrate dispatch |
| `DATABASE_URL` | optional fallback for the same production URL |

Optional: Environment **production** with required reviewers so a human must approve schema changes to live Supabase.

### Branch protection (Settings → Branches → main)

- Require a pull request before merging  
- Require status checks: **ci / check**  
- Do not allow bypassing for admins (recommended)

### Workflows

- `.github/workflows/ci.yml` — lint, test, build on PRs and pushes to `main` / `staging`  
- `.github/workflows/migrate.yml` — `supabase db push` **only on `main`** (production Supabase)  
- **Vercel** — Production from `main` after Deployment Checks; Preview from other branches  

### Manual migration (laptop)

```bash
npm run db:push:prod
```

Confirm with:

```bash
npx supabase migration list --db-url "$PRODUCTION_DATABASE_URL"
```

Remote must list every migration file, including `20260914230000`, `20260915001500`, and `20260915010000`.

---

## 6. Smoke test before opening registrations

1. Signup → Brevo verification email arrives  
2. Register with 2–3 committee preferences (payment stays locked)  
3. Admin allocates committee/portfolio → payment unlocks at allotted fee  
4. Upload payment proof (image is compressed to WebP server-side)  
5. Admin verify → QR email via Brevo  
6. Open `/dashboard/qr`  
7. `/api/health` and `/api/ready` return OK  
8. Admin → Edition → switch Early bird ↔ Phase 1 ↔ Phase 2 without errors  

---

## 7. Day-to-day

```bash
# Local development (unchanged)
docker compose up -d --build

# Release:
# 1. PR → CI green (preview on Vercel is fine; no DB migrate)
# 2. Merge to main → migrate production Supabase → Vercel Production
```

Images (logos, team photos, payment proofs) are compressed with Sharp to WebP before Storage upload. Previews still use the public URL at full display size — quality stays high; storage stays small enough for Supabase Free at ~400 registrations.
