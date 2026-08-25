"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasPermission, isProtectedAdminAccount, isProtectedAdminEmail } from "@/lib/auth";
import { isUuid } from "@/lib/ids";
import { optionalPasswordSchema, passwordSchema } from "@/lib/password";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ScannerState = {
  error?: string;
  success?: string;
};

const createSchema = z.object({
  full_name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  email: z.string().trim().email("Enter a valid email"),
  password: passwordSchema,
  desk: z.enum(["attendance", "food", "both"]),
  edition_id: z.string().trim(),
});

function firstIssue(error: z.ZodError): ScannerState {
  return { error: error.issues[0]?.message ?? "Please check the form" };
}

async function roleIdsForDesk(desk: "attendance" | "food" | "both") {
  const supabase = await createClient();
  const names =
    desk === "both"
      ? ["ATTENDANCE_OPERATOR", "FOOD_OPERATOR"]
      : desk === "food"
        ? ["FOOD_OPERATOR"]
        : ["ATTENDANCE_OPERATOR"];
  const { data } = await supabase.from("roles").select("id, name").in("name", names);
  return (data ?? []) as Array<{ id: string; name: string }>;
}

export async function createScannerAction(
  _prev: ScannerState,
  formData: FormData,
): Promise<ScannerState> {
  const allowed = await hasPermission("users.manage");
  if (!allowed) return { error: "You need users.manage to create scanner logins." };

  const parsed = createSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    password: formData.get("password"),
    desk: formData.get("desk"),
    edition_id: formData.get("edition_id"),
  });
  if (!parsed.success) return firstIssue(parsed.error);
  if (isProtectedAdminEmail(parsed.data.email)) {
    return { error: "That email is reserved for the admin account." };
  }

  const editionId = parsed.data.edition_id;
  if (editionId && editionId !== "all" && !isUuid(editionId)) {
    return { error: "Select an edition." };
  }

  const roles = await roleIdsForDesk(parsed.data.desk);
  if (!roles.length) return { error: "Scanner roles are missing from the database." };

  const admin = createAdminClient();
  const created = await admin.auth.admin.createUser({
    email: parsed.data.email.toLowerCase(),
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.full_name },
  });
  if (created.error || !created.data.user) {
    const message = created.error?.message.toLowerCase() ?? "";
    if (message.includes("already") || message.includes("registered")) {
      return { error: "That email already has an account. Use a different scanner email." };
    }
    return { error: created.error?.message ?? "Could not create the scanner login." };
  }

  const userId = created.data.user.id;
  await admin.from("users").update({ full_name: parsed.data.full_name }).eq("id", userId);

  const scopedEdition = editionId && editionId !== "all" ? editionId : null;
  const rows = roles.map((role) => ({
    user_id: userId,
    role_id: role.id,
    edition_id: scopedEdition,
  }));
  const assigned = await admin.from("user_roles").insert(rows);
  if (assigned.error) {
    await admin.auth.admin.deleteUser(userId);
    return { error: assigned.error.message };
  }

  await admin.from("scanner_secrets").upsert({
    user_id: userId,
    password_plain: parsed.data.password,
    updated_at: new Date().toISOString(),
  });

  revalidatePath("/admin/scanners");
  return { success: `Scanner ${parsed.data.email.toLowerCase()} can sign in and open Scan.` };
}

const updateSchema = z.object({
  full_name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  email: z.string().trim().email("Enter a valid email"),
  password: optionalPasswordSchema,
});

export async function updateScannerCredentialsAction(
  userId: string,
  _prev: ScannerState,
  formData: FormData,
): Promise<ScannerState> {
  const allowed = await hasPermission("users.manage");
  if (!allowed) return { error: "You need users.manage to edit scanner logins." };
  if (!isUuid(userId)) return { error: "Missing scanner." };
  if (await isProtectedAdminAccount(userId)) {
    return { error: "The admin account cannot be edited here." };
  }

  const parsed = updateSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    password: formData.get("password") ?? "",
  });
  if (!parsed.success) return firstIssue(parsed.error);
  if (isProtectedAdminEmail(parsed.data.email)) {
    return { error: "That email is reserved for the admin account." };
  }

  const admin = createAdminClient();
  const authPatch: { email: string; password?: string; user_metadata: { full_name: string } } = {
    email: parsed.data.email.toLowerCase(),
    user_metadata: { full_name: parsed.data.full_name },
  };
  if (parsed.data.password) authPatch.password = parsed.data.password;
  const updated = await admin.auth.admin.updateUserById(userId, authPatch);
  if (updated.error) return { error: updated.error.message };

  const { error } = await admin
    .from("users")
    .update({ full_name: parsed.data.full_name, email: parsed.data.email.toLowerCase() })
    .eq("id", userId);
  if (error) return { error: error.message };

  if (parsed.data.password) {
    await admin.from("scanner_secrets").upsert({
      user_id: userId,
      password_plain: parsed.data.password,
      updated_at: new Date().toISOString(),
    });
  }

  const supabase = await createClient();
  await supabase.rpc("write_audit", {
    p_action: "scanner.update",
    p_entity: "users",
    p_entity_id: userId,
    p_old: null,
    p_new: { email: parsed.data.email.toLowerCase(), password_changed: Boolean(parsed.data.password) },
  });
  revalidatePath("/admin/scanners");
  return { success: "Scanner login updated." };
}

export async function removeScannerRoleAction(
  assignmentId: string,
  _prev: ScannerState,
  _formData: FormData,
): Promise<ScannerState> {
  void _prev;
  void _formData;
  const allowed = await hasPermission("users.manage");
  if (!allowed) return { error: "You need users.manage to remove scanners." };
  if (!isUuid(assignmentId)) return { error: "Missing assignment." };

  const admin = createAdminClient();
  const { data: assignment } = await admin
    .from("user_roles")
    .select("user_id")
    .eq("id", assignmentId)
    .maybeSingle();
  if (assignment && (await isProtectedAdminAccount(assignment.user_id))) {
    return { error: "The admin account cannot be removed." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("user_roles").delete().eq("id", assignmentId);
  if (error) return { error: error.message };
  revalidatePath("/admin/scanners");
  return { success: "Scanner access removed." };
}
