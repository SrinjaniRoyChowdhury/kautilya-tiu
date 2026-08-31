# Production go-live guide — Niti Sabha / technokautilya.in
#
# Model: main is live. There is no public staging site.
# GitHub Actions CI (lint/test/build) gates every PR; Vercel deploys production from main.

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

## 1. Hosted Supabase (Free)

1. Create a project at https://supabase.com  
2. **Settings → API**: copy Project URL, `anon` key, `service_role` key  
3. **Settings → Database**: copy connection string (use pooler URI if offered) → `DATABASE_URL`  
4. Apply schema: SQL editor → run each file in `supabase/migrations/` in filename order  
   - Or from a machine with CLI: `npx supabase db push --db-url "$DATABASE_URL"`  
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
4. Add environment variables for **Production** (copy from `.env.production.example`):

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

`DATABASE_URL` is only needed locally for `supabase db push` / bootstrap — not required on Vercel unless you add server-side migration tooling.

5. Deploy once from the Vercel dashboard (or push to `main` after connecting the repo).

6. **Settings → Domains**: add `technokautilya.in` and `www.technokautilya.in`. Vercel shows the DNS records to add at GoDaddy.

7. Optional — wait for CI before production: **Settings → Git → Deployment Checks** → require the **ci / check** status on `main`.

8. Bootstrap superadmin (section above).

9. Smoke test:

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

## 5. GitHub: CI gate (no separate deploy workflow)

### Branch protection (Settings → Branches → main)

- Require a pull request before merging  
- Require status checks: **ci / check**  
- Do not allow bypassing for admins (recommended)

### Workflows

- `.github/workflows/ci.yml` — lint, test, build on every PR and push  
- **Vercel** — production deploy when `main` is updated (Git integration; no SSH secrets in GitHub Actions)

No `ORACLE_*` or other deploy secrets are needed in GitHub.

---

## 6. Smoke test before opening registrations

1. Signup → Brevo verification email arrives  
2. Register for a committee  
3. Upload payment proof (image is compressed to WebP server-side)  
4. Admin verify → QR email via Brevo  
5. Open `/dashboard/qr`  
6. `/api/health` and `/api/ready` return OK  

---

## 7. Day-to-day

```bash
# Local development (unchanged)
docker compose up -d --build

# Production: merge PR to main → Vercel redeploys automatically
# Preview URLs: every PR gets a Vercel preview deployment
```

Images (logos, team photos, payment proofs) are compressed with Sharp to WebP before Storage upload. Previews still use the public URL at full display size — quality stays high; storage stays small enough for Supabase Free at ~400 registrations.
