"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasPermission, isProtectedAdminAccount } from "@/lib/auth";
import { isUuid } from "@/lib/ids";
import { optionalPasswordSchema, passwordSchema } from "@/lib/password";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  ACCOUNT_KINDS,
  rolesForAccountKind,
  staffEmailFromUsername,
  usernameSchema,
  type AccountKind,
} from "@/lib/username";

export type AccountState = {
  error?: string;
  success?: string;
};

const createSchema = z.object({
  full_name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  username: usernameSchema,
  password: passwordSchema,
  kind: z.enum(ACCOUNT_KINDS),
  desk: z.enum(["attendance", "food", "both"]).optional(),
  edition_id: z.string().trim().optional(),
});

const updateSchema = z.object({
  full_name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  username: usernameSchema,
  password: optionalPasswordSchema,
  kind: z.enum(ACCOUNT_KINDS),
  desk: z.enum(["attendance", "food", "both"]).optional(),
  edition_id: z.string().trim().optional(),
});

function firstIssue(error: z.ZodError): AccountState {
  return { error: error.issues[0]?.message ?? "Please check the form" };
}

function revalidateAccounts() {
  revalidatePath("/admin/accounts");
}

async function roleRowsByName(names: string[]) {
  const supabase = await createClient();
  const { data } = await supabase.from("roles").select("id, name").in("name", names);
  return (data ?? []) as Array<{ id: string; name: string }>;
}

function scopedEdition(kind: AccountKind, editionId: string | undefined) {
  if (kind !== "scanner") return null;
  if (!editionId || editionId === "all") return null;
  if (!isUuid(editionId)) return "invalid";
  return editionId;
}

export async function createStaffAccountAction(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const allowed = await hasPermission("users.manage");
  if (!allowed) return { error: "You need users.manage to create accounts." };

  const parsed = createSchema.safeParse({
    full_name: formData.get("full_name"),
    username: formData.get("username"),
    password: formData.get("password"),
    kind: formData.get("kind"),
    desk: formData.get("desk") || undefined,
    edition_id: formData.get("edition_id") || undefined,
  });
  if (!parsed.success) return firstIssue(parsed.error);

  const edition = scopedEdition(parsed.data.kind, parsed.data.edition_id);
  if (edition === "invalid") return { error: "Select an edition." };

  const roleNames = rolesForAccountKind(parsed.data.kind, parsed.data.desk ?? "both");
  const roles = await roleRowsByName(roleNames);
  if (roles.length !== roleNames.length) {
    return { error: "That account type is missing from the database." };
  }

  const admin = createAdminClient();
  const { data: taken } = await admin
    .from("users")
    .select("id")
    .eq("username", parsed.data.username)
    .maybeSingle();
  if (taken) return { error: "That username is already in use." };

  const email = staffEmailFromUsername(parsed.data.username);
  const created = await admin.auth.admin.createUser({
    email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.full_name, username: parsed.data.username },
  });
  if (created.error || !created.data.user) {
    const message = created.error?.message.toLowerCase() ?? "";
    if (message.includes("already") || message.includes("registered")) {
      return { error: "That username is already in use." };
    }
    return { error: created.error?.message ?? "Could not create the account." };
  }

  const userId = created.data.user.id;
  await admin
    .from("users")
    .update({
      full_name: parsed.data.full_name,
      username: parsed.data.username,
      email,
    })
    .eq("id", userId);

  const assigned = await admin.from("user_roles").insert(
    roles.map((role) => ({
      user_id: userId,
      role_id: role.id,
      edition_id: edition,
    })),
  );
  if (assigned.error) {
    await admin.from("users").delete().eq("id", userId);
    await admin.auth.admin.deleteUser(userId);
    return { error: assigned.error.message };
  }

  await admin.from("scanner_secrets").upsert({
    user_id: userId,
    password_plain: parsed.data.password,
    updated_at: new Date().toISOString(),
  });

  revalidateAccounts();
  return { success: `${parsed.data.username} can sign in with that username and password.` };
}

export async function updateStaffAccountAction(
  userId: string,
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const allowed = await hasPermission("users.manage");
  if (!allowed) return { error: "You need users.manage to edit accounts." };
  if (!isUuid(userId)) return { error: "Missing account." };
  if (await isProtectedAdminAccount(userId)) {
    return { error: "The admin account cannot be edited here." };
  }

  const parsed = updateSchema.safeParse({
    full_name: formData.get("full_name"),
    username: formData.get("username"),
    password: formData.get("password") ?? "",
    kind: formData.get("kind"),
    desk: formData.get("desk") || undefined,
    edition_id: formData.get("edition_id") || undefined,
  });
  if (!parsed.success) return firstIssue(parsed.error);

  const edition = scopedEdition(parsed.data.kind, parsed.data.edition_id);
  if (edition === "invalid") return { error: "Select an edition." };

  const roleNames = rolesForAccountKind(parsed.data.kind, parsed.data.desk ?? "both");
  const roles = await roleRowsByName(roleNames);
  if (roles.length !== roleNames.length) {
    return { error: "That account type is missing from the database." };
  }

  const admin = createAdminClient();
  const { data: clash } = await admin
    .from("users")
    .select("id")
    .eq("username", parsed.data.username)
    .neq("id", userId)
    .maybeSingle();
  if (clash) return { error: "That username is already in use." };

  const email = staffEmailFromUsername(parsed.data.username);
  const authPatch: {
    email: string;
    password?: string;
    user_metadata: { full_name: string; username: string };
  } = {
    email,
    user_metadata: { full_name: parsed.data.full_name, username: parsed.data.username },
  };
  if (parsed.data.password) authPatch.password = parsed.data.password;
  const updated = await admin.auth.admin.updateUserById(userId, authPatch);
  if (updated.error) return { error: updated.error.message };

  const { error } = await admin
    .from("users")
    .update({
      full_name: parsed.data.full_name,
      username: parsed.data.username,
      email,
    })
    .eq("id", userId);
  if (error) return { error: error.message };

  await admin.from("user_roles").delete().eq("user_id", userId);
  const assigned = await admin.from("user_roles").insert(
    roles.map((role) => ({
      user_id: userId,
      role_id: role.id,
      edition_id: edition,
    })),
  );
  if (assigned.error) return { error: assigned.error.message };

  if (parsed.data.password) {
    await admin.from("scanner_secrets").upsert({
      user_id: userId,
      password_plain: parsed.data.password,
      updated_at: new Date().toISOString(),
    });
  }

  const supabase = await createClient();
  await supabase.rpc("write_audit", {
    p_action: "account.update",
    p_entity: "users",
    p_entity_id: userId,
    p_old: null,
    p_new: {
      username: parsed.data.username,
      kind: parsed.data.kind,
      password_changed: Boolean(parsed.data.password),
    },
  });
  revalidateAccounts();
  return { success: "Account credentials updated." };
}

export async function deleteStaffAccountAction(
  userId: string,
  _prev: AccountState,
  _formData: FormData,
): Promise<AccountState> {
  void _prev;
  void _formData;
  const allowed = await hasPermission("users.manage");
  if (!allowed) return { error: "You need users.manage to delete accounts." };
  if (!isUuid(userId)) return { error: "Missing account." };
  if (await isProtectedAdminAccount(userId)) {
    return { error: "The admin account cannot be deleted." };
  }

  const admin = createAdminClient();
  await admin.from("user_roles").delete().eq("user_id", userId);
  await admin.from("scanner_secrets").delete().eq("user_id", userId);
  await admin
    .from("users")
    .update({
      status: "SUSPENDED",
      username: null,
      email: `deleted-${userId}@staff.kautilya.local`,
    })
    .eq("id", userId);

  const rotated = `${crypto.randomUUID().replace(/-/g, "")}Aa1`;
  await admin.auth.admin.updateUserById(userId, {
    password: rotated,
    email: `deleted-${userId}@staff.kautilya.local`,
  });

  const supabase = await createClient();
  await supabase.rpc("write_audit", {
    p_action: "account.delete",
    p_entity: "users",
    p_entity_id: userId,
    p_old: null,
    p_new: { status: "SUSPENDED" },
  });
  revalidateAccounts();
  return { success: "Account deleted." };
}
