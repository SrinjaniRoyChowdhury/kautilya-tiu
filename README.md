<div align="center">

# 🏛️ Kautilya (Niti Sabha)

**Enterprise-Grade, Zero-Cost Multi-Edition Model United Nations Platform**

[![Next.js](https://img.shields.io/badge/Next.js-16.3.2-black?style=for-the-badge&logo=nextdotjs)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.8-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Database%20%26%20Auth-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.0-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Containerized-2496ED?style=for-the-badge&logo=docker)](https://www.docker.com/)

---

[Key Features](#-key-features) • [Tech Stack](#-tech-stack) • [Quick Start](#-quick-start) • [Environment Setup](#-environment-variables) • [Deployment](#-production-deployment) • [Testing & Security](#-testing--security)

</div>

---

## 📌 Executive Overview

**Kautilya** (powering [technokautilya.in](https://technokautilya.in)) is an all-in-one, multi-edition Model United Nations (MUN) platform engineered for high-concurrency delegate management, payment verification, automated QR ticketing, and real-time on-site event logistics.

Designed around a **₹0 operational budget model**, Kautilya leverages a zero-cost stack (Vercel Free + Supabase Free + Brevo Free + Mailpit) while delivering high availability, multi-tier security hardening, and production-grade performance.

---

## ✨ Key Features

### 👤 Delegate Portal
- **Secure Authentication**: Email/password authentication, email verification links, and password reset flows powered by Supabase Auth & custom SMTP routing.
- **Dynamic Multi-Preference Registration**: Committee and portfolio preference selection with real-time seat locking and capacity guards.
- **Flexible Payments**: UPI/Bank transfer instructions, proof-of-payment image uploads (auto-compressed to WebP), group payment handling via email, and status tracking.
- **Opaque QR Pass Generation**: Unique digital credentials sent via email and accessible through the delegate dashboard for seamless venue entry.

### 🛡️ Secretariat & Admin Suite
- **Multi-Edition & Committee CRUD**: Manage conference phases (Early Bird, Phase 1, Phase 2), committees, pricing tiers, payment instructions, and meal schedules.
- **Manual & Automated Portfolio Allocation**: Free-text allotment engine with delegate notification triggers.
- **Payment Verification Queue**: Admin interface for auditing uploaded payment proofs, approving/rejecting payments, and triggering ticket generation.
- **Analytics & Reporting**: Edition-scoped live KPIs, real-time registration counts, revenue metrics, CSV exports, and immutable audit logs.
- **Headless CMS Engine**: Full administrative control over homepage banners, announcements, team profiles, gallery media, and official rulebook links.

### 📱 On-Site Event Logistics (Scanner App)
- **Multi-Day Attendance Scanner**: High-speed camera scanner for daily delegate check-in/check-out verification.
- **Catering & Meal Redemption**: Dedicated food scanner preventing double-redemption of meal passes per day/meal slot.
- **Offline Reliability**: Local queueing with background auto-sync for intermittent venue connectivity, accompanied by manual correction workflows.

---

## 🛠️ Tech Stack

| Layer | Technologies |
| --- | --- |
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router, Server Actions, React 19) |
| **Styling & UI** | [Tailwind CSS v4](https://tailwindcss.com/), [Framer Motion](https://www.framer.com/motion/), [Base UI](https://base-ui.com/), [Shadcn UI](https://ui.shadcn.com/), Lucide Icons, Sonner |
| **State & Data Fetching** | [TanStack React Query v5](https://tanstack.com/query), React Hook Form, Zod Schema Validation |
| **Database & Auth** | [Supabase](https://supabase.com/) (PostgreSQL with RLS Policies, Supabase Auth, Storage Buckets) |
| **Media Processing** | [Sharp](https://sharp.pixelplumbing.com/) (Server-side WebP image optimization & compression) |
| **Local Dev & Testing** | Docker & Docker Compose, Mailpit (SMTP Sandbox), Vitest |
| **Deployment & Mail** | Vercel (App Hosting), Brevo (Transactional Email), GitHub Actions (CI/CD & DB Migrations) |

---

## 📂 Repository Structure

```gss
kautilya/
├── .github/
│   └── workflows/          # GitHub Actions CI/CD & Migration pipelines
├── backups/                # Local database SQL dumps (gitignored)
├── docker-compose.yml      # Full-stack local dev environment (Next.js + Supabase + Mailpit)
├── scripts/                # Database backup, admin bootstrap, env verification, smoke scripts
├── src/
│   ├── app/                # Next.js App Router (Public routes, /admin, /dashboard, /scan, /api)
│   ├── components/         # Atomic UI components, forms, scanner, & admin controls
│   ├── lib/                # Supabase clients, utilities, validation schemas, email helpers
│   ├── styles/             # Global CSS and custom styles
│   └── types/              # TypeScript declarations and database interfaces
└── supabase/
    ├── migrations/         # Production-ready PostgreSQL migration scripts
    └── config.toml         # Local Supabase configuration
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- [Node.js](https://nodejs.org/) v20.9+ installed

### 1. Clone & Configure Environment
```bash
git clone https://github.com/SrinjaniRoyChowdhury/kautilya-tiu.git
cd kautilya

# Copy local environment template
cp .env.example .env

# PowerShell (Windows):
# Copy-Item .env.example .env
```

### 2. Start Full Stack with Docker Compose
Run the containerized stack (includes Next.js hot reload, Supabase local instance, PostgreSQL, and Mailpit):
```bash
docker compose up --build
```

Access the local services once initialization completes:
- 🌐 **Web App**: [http://localhost:3000](http://localhost:3000)
- 🗄️ **Supabase Studio**: [http://127.0.0.1:54323](http://127.0.0.1:54323)
- ✉️ **Mailpit (Local Inbox)**: [http://127.0.0.1:54324](http://127.0.0.1:54324)
- 🔌 **Supabase API Gateway**: [http://127.0.0.1:54321](http://127.0.0.1:54321)

To stop services while preserving local database volumes:
```bash
docker compose down
```

### 3. Seed Accounts (Local Development)

| Role | Email | Password | Access Level |
| --- | --- | --- | --- |
| **Super Admin** | `admin@kautilya.local` | `KautilyaAdmin!26` | Full Secretariat & CMS Control |
| **Delegate** | `delegate@kautilya.local` | `Delegate!26` | Participant Dashboard & Payment Flow |

> 💡 **Desk Scanners**: Created dynamically in **Admin → Scanners**. Scanners log in at `/login` and are automatically routed to `/scan`.

---

## ⚙️ Environment Variables

| Variable | Scope | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Client/Server | Canonical base URL (e.g., `http://localhost:3000` or `https://technokautilya.in`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Client | Supabase endpoint URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client | Supabase anonymous API key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Supabase privileged service role key (Never expose to client) |
| `SUPABASE_INTERNAL_URL` | Server (Docker) | Internal Docker network bridge URL (`http://host.docker.internal:54321`) |
| `BREVO_API_KEY` | Server | Brevo API key for transactional emails & credential delivery |
| `MAIL_FROM` | Server | Verified email address for outgoing messages |
| `MAIL_FROM_NAME` | Server | Sender display name (e.g., `Niti Sabha`) |
| `MAILPIT_URL` | Server (Local) | Local Mailpit capture endpoint (Leave empty in production) |

Run environment verification at any time:
```bash
npm run env:verify        # Verify local environment variables
npm run env:verify:prod   # Verify production environment variables
```

---

## 📦 Production Deployment

The production infrastructure runs on **Vercel** connected to a hosted **Supabase Free** project and **Brevo** for mail dispatch.

For a step-by-step go-live walkthrough, consult **[DEPLOY.md](./DEPLOY.md)**.

### Release Architecture Pipeline
1. **GitHub Actions CI (`ci.yml`)**: Executes liveness checks, ESLint, Vitest unit tests, and production build verification on every Pull Request.
2. **Automated Migrations (`migrate.yml`)**: Applies pending SQL migrations from `supabase/migrations/` to the hosted production database on push to `main`.
3. **Vercel Production Deployment**: Gated by GitHub Deployment Checks (`ci / check` and `migrate / apply`) to guarantee database compatibility before traffic cutover.

### Bootstrapping Production Admin
Execute once from a local machine with production credentials configured in `.env.production`:
```bash
export BOOTSTRAP_ADMIN_EMAIL='admin@yourdomain.com'
export BOOTSTRAP_ADMIN_PASSWORD='YourSecurePassword123!'
export BOOTSTRAP_ADMIN_NAME='Secretariat'
npm run bootstrap:admin:prod
```

---

## 🔒 Security, Hardening & Quality Assurance

- **Zero-Trust Auth & RLS**: All database tables enforce Row Level Security (RLS) policies.
- **Security Headers & Sanitization**: Strict Content Security Policy (CSP), OWASP-compliant security headers, HTML input sanitization, and rate-limiting on sensitive endpoints (Auth, Payments, Scanners).
- **Media Validation**: Server-side image magic-byte inspection before processing uploads with Sharp to prevent arbitrary file execution.
- **Health & Readiness Monitoring**:
  - `GET /api/health` — Container process liveness probe
  - `GET /api/ready` — Database reachability probe

### Running Tests & Utility Scripts
```bash
# Run unit test suite
npm test

# Run linter
npm run lint

# Execute load & smoke test (App must be running on :3000)
npm run smoke

# Generate local database backup
npm run db:backup
```

---

## 🗺️ Project Roadmap & Phase Status

| Phase | Module / Target | Status |
| :---: | --- | :---: |
| **Phase 1** | Foundation (Auth, RLS Schema, Editions, Committees, Public Site) | ✅ Complete |
| **Phase 2** | Registration (Dynamic Forms, Dashboard, Capacity Locking) | ✅ Complete |
| **Phase 3** | Payments (UPI Proof, Group Payments, Admin Verification) | ✅ Complete |
| **Phase 4** | QR Logistics (Pass Generation, Mail Dispatch, Regeneration) | ✅ Complete |
| **Phase 5** | On-Site Operations (Attendance & Food Scanners, Offline Queue) | ✅ Complete |
| **Phase 6** | Secretariat Hub (Analytics, CMS Management, CSV Exports) | ✅ Complete |
| **Phase 7** | System Hardening (Rate Limits, Security Headers, CI/CD Pipeline) | ✅ Complete |

---

## 📄 License

This project is open-source software under the MIT License.
