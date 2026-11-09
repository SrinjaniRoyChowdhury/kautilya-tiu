import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

function displayNameFromEmail(email: string) {
  const local = email.split("@")[0]?.trim() || "Delegate";
  return local.replace(/[._+-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Ensures a public.users + auth user exists for admin-managed registration flows.
 * Creates the account if missing; confirms email automatically; reactivates inactive users.
 */
export async function ensureAdminManagedUser(
  email: string,
  fullName?: string | null,
): Promise<{ id: string } | { error: string }> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) {
    return { error: "Enter a valid email address." };
  }

  const admin = createAdminClient();
  const name = (fullName ?? "").trim() || displayNameFromEmail(normalized);

  const { data: existing } = await admin
    .from("users")
    .select("id, email_verified_at, status, deleted_at, full_name")
    .eq("email", normalized)
    .maybeSingle();

  if (existing?.deleted_at) {
    return { error: "That account was deleted and cannot be used." };
  }

  if (existing) {
    if (existing.status !== "ACTIVE") {
      const { error } = await admin.from("users").update({ status: "ACTIVE" }).eq("id", existing.id);
      if (error) return { error: error.message };
    }
    if (!existing.email_verified_at) {
      const confirmed = await admin.auth.admin.updateUserById(existing.id, { email_confirm: true });
      if (confirmed.error) return { error: confirmed.error.message };
      await admin
        .from("users")
        .update({ email_verified_at: new Date().toISOString() })
        .eq("id", existing.id);
    }
    if (fullName?.trim() && (!existing.full_name || existing.full_name === "Delegate")) {
      await admin.from("users").update({ full_name: name }).eq("id", existing.id);
    }
    return { id: existing.id };
  }

  const password = randomBytes(24).toString("base64url");
  const created = await admin.auth.admin.createUser({
    email: normalized,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });

  if (created.error || !created.data.user) {
    const message = (created.error?.message ?? "").toLowerCase();
    if (message.includes("already") || message.includes("registered")) {
      // Race: auth user exists but public.users lookup missed — re-query.
      const { data: raced } = await admin
        .from("users")
        .select("id")
        .eq("email", normalized)
        .maybeSingle();
      if (raced?.id) {
        await admin.auth.admin.updateUserById(raced.id, { email_confirm: true });
        await admin
          .from("users")
          .update({ email_verified_at: new Date().toISOString(), status: "ACTIVE" })
          .eq("id", raced.id);
        return { id: raced.id };
      }
    }
    return { error: created.error?.message ?? "Could not create the account." };
  }

  const userId = created.data.user.id;
  await admin
    .from("users")
    .update({
      full_name: name,
      email: normalized,
      email_verified_at: new Date().toISOString(),
      status: "ACTIVE",
    })
    .eq("id", userId);

  return { id: userId };
}
