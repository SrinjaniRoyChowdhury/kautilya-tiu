"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasPermission, isProtectedAdminAccount } from "@/lib/auth";
import { isUuid } from "@/lib/ids";
import { passwordSchema } from "@/lib/password";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ParticipantAdminState = {
  error?: string;
  success?: string;
};

async function paidRegistration(registrationId: string, admin = createAdminClient()) {
  const { data: registration } = await admin
    .from("registrations")
    .select("id, status, user_id, edition_id, deleted_at")
    .eq("id", registrationId)
    .maybeSingle();
  if (!registration || registration.deleted_at) return { registration: null, paid: true };
  const { data: links } = await admin
    .from("payment_participants")
    .select("payments (status)")
    .eq("registration_id", registrationId);
  type Row = { payments: { status: string } | { status: string }[] | null };
  const statuses = ((links as Row[] | null) ?? []).flatMap((row) => {
    const pay = row.payments;
    if (!pay) return [];
    return Array.isArray(pay) ? pay.map((item) => item.status) : [pay.status];
  });
  const paid =
    registration.status === "CONFIRMED" ||
    registration.status === "PAYMENT_VERIFIED" ||
    statuses.some((status) => status === "VERIFIED" || status === "UNDER_REVIEW");
  return { registration, paid };
}

export async function setParticipantPasswordAction(
  registrationId: string,
  _prev: ParticipantAdminState,
  formData: FormData,
): Promise<ParticipantAdminState> {
  if (!isUuid(registrationId)) return { error: "Missing participant." };

  const parsed = z.object({ password: passwordSchema }).safeParse({
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter a valid password." };

  const admin = createAdminClient();
  const { data: registration } = await admin
    .from("registrations")
    .select("user_id, edition_id")
    .eq("id", registrationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!registration) return { error: "Participant not found." };
  if (await isProtectedAdminAccount(registration.user_id)) {
    const canManage = await hasPermission("users.manage");
    if (!canManage) return { error: "Only an admin can change this account’s password." };
  } else {
    const allowed = await hasPermission("registration.edit");
    if (!allowed) return { error: "You need registration.edit to change a delegate password." };
  }

  const updated = await admin.auth.admin.updateUserById(registration.user_id, {
    password: parsed.data.password,
  });
  if (updated.error) return { error: updated.error.message };

  const supabase = await createClient();
  await supabase.rpc("write_audit", {
    p_action: "user.password_set",
    p_entity: "users",
    p_entity_id: registration.user_id,
    p_old: null,
    p_new: { registration_id: registrationId },
  });
  revalidatePath("/admin/participants");
  revalidatePath(`/admin/participants/${registrationId}`);
  return { success: "Password updated. Share it out of band." };
}

export async function deleteParticipantAction(
  registrationId: string,
  _prev: ParticipantAdminState,
  _formData: FormData,
): Promise<ParticipantAdminState> {
  void _prev;
  void _formData;
  if (!isUuid(registrationId)) return { error: "Missing participant." };
  const allowed = await hasPermission("registration.edit");
  if (!allowed) return { error: "You need registration.edit to delete a delegate." };

  const admin = createAdminClient();
  const { registration, paid } = await paidRegistration(registrationId, admin);
  if (!registration) return { error: "Participant not found." };
  if (await isProtectedAdminAccount(registration.user_id)) {
    return { error: "The admin account cannot be deleted. An admin can change its password instead." };
  }
  if (paid) return { error: "This delegate has a payment in review or verified, so they cannot be deleted." };

  const { error } = await admin
    .from("registrations")
    .update({ status: "CANCELLED", deleted_at: new Date().toISOString() })
    .eq("id", registrationId);
  if (error) return { error: error.message };

  const supabase = await createClient();
  await supabase.rpc("write_audit", {
    p_action: "registration.delete",
    p_entity: "registrations",
    p_entity_id: registrationId,
    p_old: { status: registration.status, user_id: registration.user_id },
    p_new: { status: "CANCELLED" },
  });
  revalidatePath("/admin/participants");
  revalidatePath("/admin/credentials");
  revalidatePath("/admin");
  return { success: "Participant removed. They had not paid yet." };
}
