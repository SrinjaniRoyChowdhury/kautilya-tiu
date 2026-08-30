# Production go-live guide — Niti Sabha / technokautilya.in
#
# Model: main is live. There is no public staging site.
# GitHub Actions CI (lint/test/build) gates every PR; deploy runs only from main after CI passes.

## Superadmin username / password (live)

**Do not put the password in git, `.env.example`, or GitHub Actions logs.**

Create the first admin once on the Oracle host after Supabase is connected:

```bash
cd /opt/kautilya
export BOOTSTRAP_ADMIN_EMAIL='you@yourdomain.com'   # real inbox you control
export BOOTSTRAP_ADMIN_PASSWORD='long-random-secret' # ≥12 chars
export BOOTSTRAP_ADMIN_NAME='Secretariat'
npm run bootstrap:admin:prod
```

That script uses `SUPABASE_SERVICE_ROLE_KEY` from `.env.production` (or `.env`) on the server to:

1. Create (or update) the Auth user  
2. Upsert `public.users`  
3. Grant the `SUPER_ADMIN` role  

Then sign in at `https://technokautilya.in/login`.

Optional: set `PROTECTED_ADMIN_EMAILS=you@yourdomain.com` in `.env` so that account cannot be deleted via the admin UI.

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

In Oracle `/opt/kautilya/.env.production` (see `.env.production.example`):

```
BREVO_API_KEY=xkeysib-...
MAIL_FROM=noreply@technokautilya.in
MAIL_FROM_NAME=Niti Sabha
```

Leave `MAILPIT_URL` empty in production.

Add SPF/DKIM DNS records from Brevo for `technokautilya.in` (GoDaddy DNS).

---

## 3. Oracle Cloud VM (Always Free)

1. Create an Ubuntu VM (Ampere A1 or x86) with a public IP  
2. Security list / NSG: allow **22**, **80**, **443** inbound  
3. SSH in and install Docker + Git + Caddy:

```bash
sudo apt update && sudo apt install -y git curl
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER   # then re-login
# Caddy: https://caddyserver.com/docs/install#debian-ubuntu-raspbian
```

4. Clone the repo:

```bash
sudo mkdir -p /opt/kautilya
sudo chown $USER:$USER /opt/kautilya
git clone https://github.com/<you>/kautilya-tiu.git /opt/kautilya
cd /opt/kautilya
```

5. Create production env (never commit):

```bash
cp .env.production.example .env.production
nano .env.production
npm run env:verify:prod
```

Fill every value — hosted Supabase URL/keys, `DATABASE_URL`, Brevo, `NEXT_PUBLIC_APP_URL=https://technokautilya.in`. Leave `MAILPIT_URL` and `SUPABASE_INTERNAL_URL` empty.

Alternatively you may name the file `.env` on the server; `docker compose` loads `.env.production` first, then `.env` as fallback.

6. First deploy:

```bash
npm run compose:prod:detached
curl -fsS http://127.0.0.1:3000/api/health
```

7. Caddy HTTPS:

```bash
sudo cp deploy/oracle/Caddyfile /etc/caddy/Caddyfile
# edit email/domain if needed
sudo systemctl enable --now caddy
sudo systemctl reload caddy
```

8. Bootstrap superadmin (section above).

---

## 4. GoDaddy DNS

| Type  | Name | Value              |
|-------|------|--------------------|
| A     | @    | Oracle public IP   |
| A     | www  | Oracle public IP   |
| TXT   | @    | Brevo SPF (as shown in Brevo) |
| CNAME / TXT | (Brevo DKIM) | as shown in Brevo |

Wait for DNS propagation, then open `https://technokautilya.in`.

---

## 5. GitHub: CI gate + deploy (no public staging)

### Branch protection (Settings → Branches → main)

- Require a pull request before merging  
- Require status checks: **ci / check**  
- Do not allow bypassing for admins (recommended)

### Workflows

- `.github/workflows/ci.yml` — lint, test, build on every PR and push  
- `.github/workflows/deploy.yml` — SSH deploy to Oracle when CI succeeds on `main`

### Actions secrets

| Secret           | Value                          |
|------------------|--------------------------------|
| `ORACLE_HOST`    | VM public IP or hostname       |
| `ORACLE_USER`    | SSH user (e.g. `ubuntu`)       |
| `ORACLE_SSH_KEY` | Private key (full PEM)         |
| `ORACLE_PORT`    | optional, default `22`         |
| `ORACLE_APP_DIR` | optional, default `/opt/kautilya` |

On the VM, the deploy user needs passwordless `docker` (docker group) and a checkout of this repo at `ORACLE_APP_DIR` with a remote that can `git pull`.

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

# Production update (or wait for GitHub deploy)
cd /opt/kautilya && git pull && npm run compose:prod:detached
```

Images (logos, team photos, payment proofs) are compressed with Sharp to WebP before Storage upload. Previews still use the public URL at full display size — quality stays high; storage stays small enough for Supabase Free at ~400 registrations.
