"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hasPermission, isProtectedAdminAccount, verifyAdminCredentials } from "@/lib/auth";
import {
  getCollectives,
  getFieldDefinitions,
  getInstitutions,
  getPublicCommittees,
} from "@/lib/data";
import { isUuid } from "@/lib/ids";
import { passwordSchema } from "@/lib/password";
import {
  buildRegistrationSchema,
  parsePreferencesFromForm,
  preferencesPayloadForCommittees,
  visibleRegistrationFields,
} from "@/lib/registration";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ParticipantAdminState = {
  error?: string;
  success?: string;
};

async function paidRegistration(registrationId: string, admin = createAdminClient()) {
  const { data: registration } = await admin
    .from("registrations")
    .select("id, status, user_id, edition_id, deleted_at, confirmed_free")
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
    (registration.status === "CONFIRMED" && !registration.confirmed_free) ||
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
  revalidatePath("/admin/users");
  return { success: "Password updated. Share it out of band." };
}

export async function deleteParticipantAction(
  registrationId: string,
  _prev: ParticipantAdminState,
  formData?: FormData,
): Promise<ParticipantAdminState> {
  void _prev;
  if (!isUuid(registrationId)) return { error: "Missing participant." };
  const allowed = await hasPermission("registration.edit");
  if (!allowed) return { error: "You need registration.edit to delete a delegate." };

  const admin = createAdminClient();
  const { registration, paid } = await paidRegistration(registrationId, admin);
  if (!registration) return { error: "Participant not found." };
  if (await isProtectedAdminAccount(registration.user_id)) {
    return { error: "The admin account cannot be deleted. An admin can change its password instead." };
  }

  let authorizedByEmail: string | null = null;
  let deletionReason: string | null = null;

  if (paid) {
    const adminUsername = String(formData?.get("admin_username") ?? "").trim();
    const adminPassword = String(formData?.get("admin_password") ?? "");
    const reason = String(formData?.get("reason") ?? "").trim();

    if (!adminUsername || !adminPassword) {
      return { error: "Admin username and password are required to delete a paid participant." };
    }
    if (!reason || reason.length < 3) {
      return { error: "A valid reason (at least 3 characters) is required to delete a paid participant." };
    }

    const authRes = await verifyAdminCredentials(adminUsername, adminPassword);
    if (!authRes.success) {
      return { error: authRes.error };
    }
    authorizedByEmail = authRes.user.email ?? adminUsername;
    deletionReason = reason;
  }

  const { error } = await admin
    .from("registrations")
    .update({ status: "CANCELLED", deleted_at: new Date().toISOString() })
    .eq("id", registrationId);
  if (error) return { error: error.message };

  const supabase = await createClient();
  await supabase.rpc("write_audit", {
    p_action: paid ? "registration.delete_paid" : "registration.delete",
    p_entity: "registrations",
    p_entity_id: registrationId,
    p_old: {
      status: registration.status,
      user_id: registration.user_id,
      paid,
      confirmed_free: registration.confirmed_free,
    },
    p_new: {
      status: "CANCELLED",
      ...(deletionReason ? { reason: deletionReason } : {}),
      ...(authorizedByEmail ? { authorized_by: authorizedByEmail } : {}),
    },
  });
  revalidatePath("/admin/participants");
  revalidatePath("/admin/credentials");
  revalidatePath("/admin");
  return {
    success: paid
      ? "Paid participant removed. Reason recorded in audit log."
      : "Participant removed. They had not paid yet.",
  };
}

export async function confirmParticipantFreeAction(
  registrationId: string,
  _prev: ParticipantAdminState,
  _formData: FormData,
): Promise<ParticipantAdminState> {
  void _prev;
  void _formData;
  if (!isUuid(registrationId)) return { error: "Missing participant." };
  const allowed = await hasPermission("registration.edit");
  if (!allowed) return { error: "You need registration.edit to confirm without payment." };

  const admin = createAdminClient();
  const { registration, paid } = await paidRegistration(registrationId, admin);
  if (!registration) return { error: "Participant not found." };
  if (paid) return { error: "This delegate already has a payment or confirmation." };
  if (registration.status === "DRAFT" || registration.status === "CANCELLED") {
    return { error: "They must submit a registration before confirmation." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_registration_free", {
    p_registration_id: registrationId,
  });
  if (error) {
    const msg = error.message?.includes("ALREADY_PAID")
      ? "This delegate already has a payment or confirmation."
      : error.message?.includes("FORBIDDEN")
        ? "You need registration.edit to confirm without payment."
        : error.message?.includes("ALLOCATION_REQUIRED")
          ? "Allocate a committee and portfolio first."
        : error.message || "Could not confirm.";
    return { error: msg };
  }

  revalidatePath("/admin/participants");
  revalidatePath(`/admin/participants/${registrationId}`);
  revalidatePath("/admin/credentials");
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/qr");
  return { success: "Confirmed as a free participant. No payment was recorded." };
}

const ALLOCATE_MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "Sign in to continue.",
  FORBIDDEN: "You need registration.edit to allocate a committee.",
  NOT_FOUND: "Registration not found.",
  REGISTRATION_LOCKED: "This registration can no longer be allocated. Payment may already be under review.",
  COMMITTEE_REQUIRED: "Select a committee.",
  COMMITTEE_NOT_FOUND: "That committee is not available.",
  COMMITTEE_CLOSED: "That committee is closed.",
  COMMITTEE_FULL: "That committee has no remaining portfolios.",
  PORTFOLIO_REQUIRED: "Enter a portfolio.",
  DELEGATION_NOT_ALLOWED: "That committee does not allow this delegation type.",
};

export async function allocateRegistrationAction(
  registrationId: string,
  _prev: ParticipantAdminState,
  formData: FormData,
): Promise<ParticipantAdminState> {
  void _prev;
  if (!isUuid(registrationId)) return { error: "Missing participant." };
  const allowed = await hasPermission("registration.edit");
  if (!allowed) return { error: "You need registration.edit to allocate a committee." };

  const committeeId = String(formData.get("committee_id") ?? "").trim();
  const portfolio = String(formData.get("portfolio") ?? "").trim();
  if (!isUuid(committeeId)) return { error: "Select a committee." };

  const supabase = await createClient();
  const { data: committeeRow } = await supabase
    .from("committees")
    .select("is_special_crisis")
    .eq("id", committeeId)
    .maybeSingle();
  const isSpecialCrisis = Boolean(
    (committeeRow as { is_special_crisis?: boolean } | null)?.is_special_crisis,
  );
  if (!portfolio && !isSpecialCrisis) return { error: "Enter a portfolio." };

  const { error } = await supabase.rpc("allocate_registration", {
    p_registration_id: registrationId,
    p_committee_id: committeeId,
    p_portfolio: portfolio || null,
  });
  if (error) {
    const raw = (error.message ?? "").toUpperCase();
    for (const [code, text] of Object.entries(ALLOCATE_MESSAGES)) {
      if (raw.includes(code)) return { error: text };
    }
    return { error: error.message || "Could not allocate." };
  }

  revalidatePath("/admin/participants");
  revalidatePath(`/admin/participants/${registrationId}`);
  revalidatePath("/admin");
  revalidatePath("/admin/committees");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/pay");
  revalidatePath("/dashboard/register");
  return {
    success: isSpecialCrisis && !portfolio
      ? "Special crisis committee allocated. Payment is unlocked; portfolio can be set later if needed."
      : "Committee and portfolio allocated. Payment is now unlocked for this delegate.",
  };
}

const CREATE_MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "Sign in to continue.",
  FORBIDDEN: "You need registration.edit to add a participant.",
  EMAIL_REQUIRED: "Enter the signed-up email.",
  USER_NOT_FOUND: "No signed-up account with that email.",
  USER_INACTIVE: "That account is not active.",
  EMAIL_UNVERIFIED: "That account has not verified their email yet. Verify it under Users first.",
  ALREADY_REGISTERED: "That person already has a registration for this edition.",
  EDITION_NOT_FOUND: "Edition not found.",
  FOOD_REQUIRED: "Select a food preference.",
  PREFERENCES_REQUIRED: "Select 2 or 3 committees with portfolios.",
  COMMITTEE_NOT_FOUND: "One of the preferred committees is not available.",
  COMMITTEE_CLOSED: "One of the preferred committees is closed.",
  PORTFOLIO_REQUIRED: "Enter at least one portfolio for each preferred committee.",
  PORTFOLIO_DUPLICATE: "Do not enter the same portfolio twice for one committee.",
  PREFERENCE_DUPLICATE: "Each committee can only be selected once.",
  PARTNER_REQUIRED: "Enter the partner's signed-up email for a double delegation.",
  PARTNER_SELF: "Partner email cannot be the same as the participant.",
  PARTNER_NOT_SIGNED_UP: "Partner must already have a signed-up account.",
  PARTNER_BUSY: "That partner already has a registration that cannot be paired.",
  PARTNER_ALREADY_PAIRED: "That partner is already in another double delegation.",
  DELEGATION_NOT_ALLOWED: "That committee does not allow this delegation type.",
};

export type CreateParticipantState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: string;
  registrationId?: string;
};

export async function loadAddParticipantMetaAction(editionId: string): Promise<{
  error?: string;
  fields?: Awaited<ReturnType<typeof getFieldDefinitions>>;
  committees?: Awaited<ReturnType<typeof getPublicCommittees>>;
  collectives?: Awaited<ReturnType<typeof getCollectives>>;
  institutions?: Awaited<ReturnType<typeof getInstitutions>>;
}> {
  if (!isUuid(editionId)) return { error: "Select an edition." };
  const allowed = await hasPermission("registration.edit");
  if (!allowed) return { error: "You need registration.edit to add a participant." };
  const [fields, committees, collectives, institutions] = await Promise.all([
    getFieldDefinitions(editionId),
    getPublicCommittees(editionId),
    getCollectives(),
    getInstitutions(),
  ]);
  return {
    fields: visibleRegistrationFields(fields),
    committees: committees.filter((item) => item.status === "OPEN"),
    collectives,
    institutions,
  };
}

export async function createParticipantRegistrationAction(
  _prev: CreateParticipantState,
  formData: FormData,
): Promise<CreateParticipantState> {
  const allowed = await hasPermission("registration.edit");
  if (!allowed) return { error: "You need registration.edit to add a participant." };

  const editionId = String(formData.get("edition_id") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!isUuid(editionId)) return { error: "Select an edition." };
  if (!email) return { error: "Enter the participant's signed-up email." };

  const fields = visibleRegistrationFields(await getFieldDefinitions(editionId));
  const raw: Record<string, unknown> = {
    food_preference: String(formData.get("food_preference") ?? ""),
    collective_id: String(formData.get("collective_id") ?? ""),
    delegation_type: String(formData.get("delegation_type") ?? "SINGLE"),
    partner_email: String(formData.get("partner_email") ?? ""),
    preferences: parsePreferencesFromForm(formData),
  };
  for (const field of fields) {
    if (field.field_type === "multiselect") {
      raw[field.field_key] = formData.getAll(`${field.field_key}[]`).map(String);
    } else if (field.field_type === "boolean") {
      raw[field.field_key] = formData.get(field.field_key) === "on" || formData.get(field.field_key) === "true";
    } else {
      raw[field.field_key] = String(formData.get(field.field_key) ?? "");
    }
  }

  const prefItems = parsePreferencesFromForm(formData);
  const specialCrisisIds = new Set(
    String(formData.get("special_crisis_ids") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(isUuid),
  );
  if (!specialCrisisIds.size) {
    const ids = prefItems.map((pref) => pref.committee_id).filter(isUuid);
    if (ids.length) {
      const admin = createAdminClient();
      const { data: rows } = await admin
        .from("committees")
        .select("id, is_special_crisis")
        .in("id", ids);
      for (const row of rows ?? []) {
        if ((row as { is_special_crisis?: boolean }).is_special_crisis) {
          specialCrisisIds.add((row as { id: string }).id);
        }
      }
    }
  }

  const schema = buildRegistrationSchema(fields, {
    requirePreferences: true,
    specialCrisisCommitteeIds: specialCrisisIds,
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return {
      error: parsed.error.issues[0]?.message ?? "Please check the form",
      fieldErrors,
    };
  }

  const food = raw.food_preference as string;
  const foodPref = food === "VEG" || food === "NON_VEG" ? food : null;
  const values = fields.map((field) => {
    const value = raw[field.field_key];
    if (field.field_type === "multiselect") {
      return {
        field_definition_id: field.id,
        value_text: null,
        value_json: Array.isArray(value) ? value : [],
      };
    }
    if (field.field_type === "boolean") {
      return {
        field_definition_id: field.id,
        value_text: value ? "true" : "false",
        value_json: Boolean(value),
      };
    }
    if (field.field_type === "number") {
      const asText = value === "" || value == null || Number.isNaN(value) ? null : String(value);
      return {
        field_definition_id: field.id,
        value_text: asText,
        value_json: asText == null ? null : Number(value),
      };
    }
    return {
      field_definition_id: field.id,
      value_text: value == null ? null : String(value),
      value_json: null,
    };
  });
  const prefs = preferencesPayloadForCommittees(prefItems, specialCrisisIds);
  const collectiveRaw = String(raw.collective_id ?? "").trim();
  const collectiveId = isUuid(collectiveRaw) ? collectiveRaw : null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_create_submitted_registration", {
    p_edition_id: editionId,
    p_email: email,
    p_food_preference: foodPref,
    p_values: values,
    p_delegation_type: String(raw.delegation_type ?? "SINGLE") === "DOUBLE" ? "DOUBLE" : "SINGLE",
    p_partner_email: String(raw.partner_email ?? "").trim() || null,
    p_preferences: prefs,
    p_collective_id: collectiveId,
  });

  if (error) {
    const rawMsg = (error.message ?? "").toUpperCase();
    if (
      rawMsg.includes("COULD NOT FIND THE FUNCTION") ||
      rawMsg.includes("FUNCTION PUBLIC.ADMIN_CREATE_SUBMITTED_REGISTRATION") ||
      rawMsg.includes("PGRST202") ||
      rawMsg.includes("42883")
    ) {
      return {
        error:
          "Database migration for Add participant is not applied yet. Merge to main so migrate/apply can run, then retry.",
      };
    }
    for (const [code, text] of Object.entries(CREATE_MESSAGES)) {
      if (rawMsg.includes(code)) return { error: text };
    }
    return { error: error.message || "Could not create registration." };
  }

  const registrationId =
    data && typeof data === "object" && "id" in data ? String((data as { id: string }).id) : null;

  revalidatePath("/admin/participants");
  revalidatePath("/admin");
  revalidatePath("/dashboard/register");
  if (registrationId) {
    revalidatePath(`/admin/participants/${registrationId}`);
    redirect(`/admin/participants/${registrationId}`);
  }

  return {
    success: "Participant registration created. Allocate a committee next.",
  };
}
