#!/usr/bin/env node
/**
 * One-time production bootstrap: create (or promote) a SUPER_ADMIN.
 *
 * Usage on the Oracle host (never commit the password):
 *
 *   BOOTSTRAP_ADMIN_EMAIL=you@technokautilya.in \
 *   BOOTSTRAP_ADMIN_PASSWORD='choose-a-long-secret' \
 *   BOOTSTRAP_ADMIN_NAME='Secretariat' \
 *   node scripts/bootstrap-superadmin.mjs
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_INTERNAL_URL) and
 * SUPABASE_SERVICE_ROLE_KEY in .env.production / .env on the server.
 *
 * Pass --production if you keep prod vars only in .env.production.
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvFiles } from "./load-env.mjs";

const production = process.argv.includes("--production");
loadEnvFiles(process.cwd(), { production });

const url =
  process.env.SUPABASE_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || "").trim().toLowerCase();
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || "";
const fullName = (process.env.BOOTSTRAP_ADMIN_NAME || "Super Admin").trim();

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_INTERNAL_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
if (!email || !email.includes("@")) {
  console.error("Set BOOTSTRAP_ADMIN_EMAIL to a real address.");
  process.exit(1);
}
if (password.length < 12) {
  console.error("Set BOOTSTRAP_ADMIN_PASSWORD to at least 12 characters.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: listed, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
if (listError) {
  console.error("Could not list users:", listError.message);
  process.exit(1);
}

let userId = listed.users.find((u) => u.email?.toLowerCase() === email)?.id;

if (!userId) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) {
    console.error("Could not create auth user:", error?.message ?? "unknown");
    process.exit(1);
  }
  userId = data.user.id;
  console.log("Created auth user", email);
} else {
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) {
    console.error("Could not update password:", error.message);
    process.exit(1);
  }
  console.log("Updated existing auth user", email);
}

const { error: profileError } = await admin.from("users").upsert(
  {
    id: userId,
    email,
    full_name: fullName,
    email_verified_at: new Date().toISOString(),
  },
  { onConflict: "id" },
);
if (profileError) {
  console.error("Could not upsert public.users:", profileError.message);
  process.exit(1);
}

const { data: role, error: roleError } = await admin
  .from("roles")
  .select("id")
  .eq("name", "SUPER_ADMIN")
  .maybeSingle();
if (roleError || !role?.id) {
  console.error("SUPER_ADMIN role missing:", roleError?.message ?? "not found");
  process.exit(1);
}

const { data: existingRole } = await admin
  .from("user_roles")
  .select("id")
  .eq("user_id", userId)
  .eq("role_id", role.id)
  .is("edition_id", null)
  .maybeSingle();

if (!existingRole) {
  const { error: insertError } = await admin.from("user_roles").insert({
    user_id: userId,
    role_id: role.id,
    edition_id: null,
  });
  if (insertError) {
    console.error("Could not grant SUPER_ADMIN:", insertError.message);
    process.exit(1);
  }
}

console.log("SUPER_ADMIN ready:", email);
console.log("Sign in at your app /login — do not store this password in git.");
