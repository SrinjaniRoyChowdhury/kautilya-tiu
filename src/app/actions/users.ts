"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasPermission, isProtectedAdminAccount, verifyAdminCredentials } from "@/lib/auth";
import { APP_NAME } from "@/lib/constants";
import { isUuid } from "@/lib/ids";
import { deliverEmail } from "@/lib/mail";
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

async function isUserPaid(userId: string, admin = createAdminClient()): Promise<boolean> {
  const { data: userRegs } = await admin
    .from("registrations")
    .select("id, status, confirmed_free")
    .eq("user_id", userId)
    .is("deleted_at", null);

  const regs = userRegs ?? [];
  if (regs.length === 0) return false;

  const regIds = regs.map((r) => r.id);
  const { data: links } = await admin
    .from("payment_participants")
    .select("registration_id, payments (status)")
    .in("registration_id", regIds);

  type Link = {
    registration_id: string | null;
    payments: { status: string } | { status: string }[] | null;
  };
  const paidRegIds = new Set<string>();
  for (const link of (links as Link[] | null) ?? []) {
    if (!link.registration_id) continue;
    const pay = link.payments;
    const statuses = pay ? (Array.isArray(pay) ? pay.map((item) => item.status) : [pay.status]) : [];
    if (statuses.some((status) => status === "VERIFIED" || status === "UNDER_REVIEW")) {
      paidRegIds.add(link.registration_id);
    }
  }

  return regs.some(
    (reg) =>
      (reg.status === "CONFIRMED" && !reg.confirmed_free) ||
      reg.status === "PAYMENT_VERIFIED" ||
      reg.confirmed_free ||
      paidRegIds.has(reg.id),
  );
}

export async function manualVerifyUserAction(
  userId: string,
  _prev: UserAdminState,
  _formData?: FormData,
): Promise<UserAdminState> {
  void _prev;
  void _formData;
  if (!isUuid(userId)) return { error: "Missing user." };

  const allowed = (await hasPermission("registration.edit")) || (await hasPermission("users.manage"));
  if (!allowed) return { error: "You need permission to verify a user’s email." };

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("users")
    .select("id, email, full_name, email_verified_at")
    .eq("id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!existing) return { error: "User not found." };

  if (await isProtectedAdminAccount(userId, existing.email)) {
    const canManage = await hasPermission("users.manage");
    if (!canManage) return { error: "Only an admin can change this account." };
  }

  const { data: roles } = await admin.from("user_roles").select("id").eq("user_id", userId).limit(1);
  if (roles?.length) return { error: "Staff accounts are managed under Admin → Accounts." };

  if (existing.email_verified_at) {
    return { success: "Email is already verified." };
  }

  const updated = await admin.auth.admin.updateUserById(userId, { email_confirm: true });
  if (updated.error) return { error: updated.error.message };

  // Keep public.users in sync immediately (Auth trigger also updates email_verified_at).
  const verifiedAt = updated.data.user.email_confirmed_at ?? new Date().toISOString();
  const { error: profileError } = await admin
    .from("users")
    .update({ email_verified_at: verifiedAt })
    .eq("id", userId);
  if (profileError) return { error: profileError.message };

  const supabase = await createClient();
  await supabase.rpc("write_audit", {
    p_action: "user.email_verify_manual",
    p_entity: "users",
    p_entity_id: userId,
    p_old: { email_verified_at: null },
    p_new: { email_verified_at: verifiedAt, email: existing.email },
  });

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const mail = await deliverEmail({
    to: existing.email,
    toName: existing.full_name,
    subject: `Your ${APP_NAME} email is verified — you can sign in`,
    html: [
      `<p>Dear ${escapeHtml(existing.full_name)},</p>`,
      `<p>Your email has been verified by the ${APP_NAME} secretariat. You can sign in and continue registration.</p>`,
      `<p><a href="${appUrl}/login">Sign in</a> · <a href="${appUrl}/dashboard/register">Continue registration</a></p>`,
      `<p>If you did not create this account, reply to this email or contact the secretariat.</p>`,
    ].join(""),
  });

  await supabase.rpc("write_audit", {
    p_action: "user.email_verify_manual_notify",
    p_entity: "users",
    p_entity_id: userId,
    p_old: null,
    p_new: { delivered: mail.delivered, error: mail.error ?? null, email: existing.email },
  });

  revalidateUsers(userId);
  if (mail.delivered) {
    return {
      success: "Email verified and the user was notified by email. They can sign in and continue registration.",
    };
  }
  return {
    success: `Email verified. Notice email could not be sent (${mail.error ?? "no mail provider"}) — tell them out of band that they can sign in.`,
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function deleteSignedUpUserAction(
  userId: string,
  _prev: UserAdminState,
  formData?: FormData,
): Promise<UserAdminState> {
  void _prev;
  if (!isUuid(userId)) return { error: "Missing user." };

  const allowed = (await hasPermission("registration.edit")) || (await hasPermission("users.manage"));
  if (!allowed) return { error: "You need permission to delete a user." };

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("users")
    .select("id, email, full_name")
    .eq("id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!existing) return { error: "User not found." };

  if (await isProtectedAdminAccount(userId, existing.email)) {
    return { error: "The admin account cannot be deleted." };
  }

  const { data: roles } = await admin.from("user_roles").select("id").eq("user_id", userId).limit(1);
  if (roles?.length) {
    return { error: "Staff accounts should be deleted under Admin → Accounts." };
  }

  const paid = await isUserPaid(userId, admin);
  let authorizedByEmail: string | null = null;
  let deletionReason: string | null = null;

  if (paid) {
    const adminUsername = String(formData?.get("admin_username") ?? "").trim();
    const adminPassword = String(formData?.get("admin_password") ?? "");
    const reason = String(formData?.get("reason") ?? "").trim();

    if (!adminUsername || !adminPassword) {
      return { error: "Admin username and password are required to delete a user with paid registrations." };
    }
    if (!reason || reason.length < 3) {
      return { error: "A valid reason (at least 3 characters) is required to delete a user with paid registrations." };
    }

    const authRes = await verifyAdminCredentials(adminUsername, adminPassword);
    if (!authRes.success) {
      return { error: authRes.error };
    }
    authorizedByEmail = authRes.user.email ?? adminUsername;
    deletionReason = reason;
  }

  const now = new Date().toISOString();
  const freedEmail = `deleted_${userId}_${existing.email}`;

  const { error: userErr } = await admin
    .from("users")
    .update({
      email: freedEmail,
      status: "SUSPENDED",
      deleted_at: now,
    })
    .eq("id", userId);
  if (userErr) return { error: userErr.message };

  await admin
    .from("registrations")
    .update({
      status: "CANCELLED",
      deleted_at: now,
    })
    .eq("user_id", userId);

  try {
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) {
      await admin.auth.admin.updateUserById(userId, {
        email: `deleted_${userId}@deleted.local`,
        email_confirm: false,
      });
    }
  } catch {
    try {
      await admin.auth.admin.updateUserById(userId, {
        email: `deleted_${userId}@deleted.local`,
        email_confirm: false,
      });
    } catch {}
  }

  const supabase = await createClient();
  await supabase.rpc("write_audit", {
    p_action: paid ? "user.delete_paid" : "user.delete",
    p_entity: "users",
    p_entity_id: userId,
    p_old: { email: existing.email, full_name: existing.full_name, paid },
    p_new: {
      status: "SUSPENDED",
      deleted_at: now,
      ...(deletionReason ? { reason: deletionReason } : {}),
      ...(authorizedByEmail ? { authorized_by: authorizedByEmail } : {}),
    },
  });

  revalidateUsers(userId);
  return {
    success: paid
      ? "Paid user deleted successfully. Reason recorded in audit log."
      : "User deleted successfully.",
  };
}
