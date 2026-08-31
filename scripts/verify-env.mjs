#!/usr/bin/env node
import { loadEnvFiles } from "./load-env.mjs";

const production = process.argv.includes("--production");
loadEnvFiles(process.cwd(), { production });

const required = production
  ? [
      "NEXT_PUBLIC_APP_URL",
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "BREVO_API_KEY",
      "MAIL_FROM",
    ]
  : [
      "NEXT_PUBLIC_APP_URL",
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
    ];

const warnings = [];
const errors = [];

for (const key of required) {
  const value = (process.env[key] ?? "").trim();
  if (!value) errors.push(`Missing ${key}`);
}

if (production) {
  if ((process.env.MAILPIT_URL ?? "").trim()) {
    warnings.push("MAILPIT_URL is set — leave empty in production (use Brevo).");
  }
  if ((process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").includes("127.0.0.1")) {
    errors.push("NEXT_PUBLIC_SUPABASE_URL still points at localhost.");
  }
  if ((process.env.NEXT_PUBLIC_APP_URL ?? "").includes("localhost")) {
    errors.push("NEXT_PUBLIC_APP_URL still points at localhost.");
  }
  if ((process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").includes("supabase-demo")) {
    errors.push("NEXT_PUBLIC_SUPABASE_ANON_KEY looks like the local demo key.");
  }
} else {
  if (!(process.env.MAILPIT_URL ?? "").trim() && !(process.env.BREVO_API_KEY ?? "").trim()) {
    warnings.push("Neither MAILPIT_URL nor BREVO_API_KEY set — QR emails may not send locally.");
  }
}

if (warnings.length) {
  for (const msg of warnings) console.warn("warn:", msg);
}
if (errors.length) {
  for (const msg of errors) console.error("error:", msg);
  process.exit(1);
}

console.log(production ? "Production env looks ready." : "Local env looks ready.");
