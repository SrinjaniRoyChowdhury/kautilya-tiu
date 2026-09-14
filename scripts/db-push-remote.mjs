#!/usr/bin/env node
/**
 * Apply pending supabase/migrations to production Supabase.
 *
 * Usage:
 *   npm run db:push:prod
 *   DATABASE_URL=... node scripts/db-push-remote.mjs --allow-local   # local only if intentional
 *
 * Never runs seed.sql. Refuses local demo URLs unless --allow-local.
 * staging is Vercel preview only — there is no staging database.
 */
import { spawnSync } from "node:child_process";
import { loadEnvFiles } from "./load-env.mjs";

const allowLocal = process.argv.includes("--allow-local");

loadEnvFiles(process.cwd(), { production: true });

const url = process.env.DATABASE_URL || process.env.PRODUCTION_DATABASE_URL || "";

if (!url) {
  console.error(
    "Missing DATABASE_URL (or PRODUCTION_DATABASE_URL). Set it in .env.production for hosted Supabase.",
  );
  process.exit(1);
}

const lower = url.toLowerCase();
const looksLocal =
  lower.includes("127.0.0.1") ||
  lower.includes("localhost") ||
  lower.includes("@db:") ||
  lower.includes("supabase_db_");

if (looksLocal && !allowLocal) {
  console.error(
    "Refusing to push migrations to a local-looking DATABASE_URL. Pass --allow-local if intentional.",
  );
  process.exit(1);
}

console.log(looksLocal ? "Applying migrations to local database…" : "Applying migrations to production Supabase…");

const result = spawnSync(
  "npx",
  ["supabase", "db", "push", "--db-url", url, "--yes", "--include-all"],
  { stdio: "inherit", shell: true },
);

process.exit(result.status ?? 1);
