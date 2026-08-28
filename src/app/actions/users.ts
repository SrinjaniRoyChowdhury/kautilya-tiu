"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasPermission, isProtectedAdminAccount } from "@/lib/auth";
import { isUuid } from "@/lib/ids";
import { optionalPasswordSchema } from "@/lib/password";
import { tenDigitPhoneSchema } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type UserAdminState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: string;
};

const updateSchema = z.object({
  full_name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  email: z.string().trim().email("Enter a valid email"),
  phone: tenDigitPhoneSchema,
  password: optionalPasswordSchema,
});

function firstIssue(error: z.ZodError): UserAdminState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { error: error.issues[0]?.message ?? "Please check the form", fieldErrors };
}

async function canEditSignedUpUser(userId: string, email?: string | null): Promise<string | null> {
  if (await isProtectedAdminAccount(userId, email)) {
    const canManage = await hasPermission("users.manage");
    if (!canManage) return "Only an admin can change this account.";
    return null;
  }
  const allowed = await hasPermission("registration.edit");
  if (!allowed) return "You need registration.edit to change a signed-up user’s credentials.";
  return null;
}

function revalidateUsers(userId: string) {
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/participants");
}

export async function updateSignedUpUserAction(
  userId: string,
  _prev: UserAdminState,
  formData: FormData,
): Promise<UserAdminState> {
  if (!isUuid(userId)) return { error: "Missing user." };

  const parsed = updateSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password") ?? "",
  });
  if (!parsed.success) return firstIssue(parsed.error);

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("users")
    .select("id, email, full_name, phone")
    .eq("id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!existing) return { error: "User not found." };

  const { data: roles } = await admin.from("user_roles").select("id").eq("user_id", userId).limit(1);
  if (roles?.length) return { error: "Staff accounts are managed under Admin → Accounts." };

  const blocked = await canEditSignedUpUser(userId, existing.email);
  if (blocked) return { error: blocked };

  const authPatch: {
    email?: string;
    password?: string;
    email_confirm?: boolean;
    user_metadata?: { full_name: string; phone: string };
  } = {
    user_metadata: { full_name: parsed.data.full_name, phone: parsed.data.phone },
  };
  if (parsed.data.email.toLowerCase() !== String(existing.email).toLowerCase()) {
    authPatch.email = parsed.data.email;
    authPatch.email_confirm = true;
  }
  if (parsed.data.password) authPatch.password = parsed.data.password;

  const updated = await admin.auth.admin.updateUserById(userId, authPatch);
  if (updated.error) {
    const message = updated.error.message.toLowerCase();
    if (message.includes("already") || message.includes("registered") || message.includes("exists")) {
      return { error: "That email is already registered.", fieldErrors: { email: "That email is already registered." } };
    }
    return { error: updated.error.message };
  }

  const { error } = await admin
    .from("users")
    .update({
      full_name: parsed.data.full_name,
      email: parsed.data.email,
      phone: parsed.data.phone,
    })
    .eq("id", userId);
  if (error) {
    if (error.message.toLowerCase().includes("unique") || error.code === "23505") {
      return { error: "That email is already registered.", fieldErrors: { email: "That email is already registered." } };
    }
    return { error: error.message };
  }

  const supabase = await createClient();
  await supabase.rpc("write_audit", {
    p_action: "user.credentials_update",
    p_entity: "users",
    p_entity_id: userId,
    p_old: { email: existing.email, full_name: existing.full_name, phone: existing.phone },
    p_new: {
      email: parsed.data.email,
      full_name: parsed.data.full_name,
      phone: parsed.data.phone,
      password_changed: Boolean(parsed.data.password),
    },
  });
  revalidateUsers(userId);
  return { success: parsed.data.password ? "Credentials saved. Share the new password out of band." : "Credentials saved." };
}
