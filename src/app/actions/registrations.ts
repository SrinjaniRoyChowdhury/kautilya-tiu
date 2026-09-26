"use server";

import { revalidatePath } from "next/cache";
import { appMailConfigured, sendResendVerificationEmail } from "@/lib/auth-mail";
import { createClient } from "@/lib/supabase/server";
import { getAppOrigin } from "@/lib/origin";
import { getFieldDefinitions } from "@/lib/data";
import { isUuid } from "@/lib/ids";
import { PHONE_ERROR, isTenDigitPhone } from "@/lib/phone";
import { buildRegistrationSchema, parsePreferencesFromForm, preferencesPayloadForCommittees, visibleRegistrationFields } from "@/lib/registration";
import { normalizeOutstationPayload } from "@/lib/outstation";
import type { FoodPreference, Registration, RegistrationFieldDefinition } from "@/types";

export type RegistrationState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: string;
};

const RPC_MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "Sign in to continue.",
  EMAIL_UNVERIFIED: "Verify your email before registering. Check your inbox (and spam) for the link.",
  NOT_FOUND: "Registration not found.",
  ALREADY_REGISTERED: "You already have a registration for this edition.",
  EDITION_NOT_OPEN: "This edition is not open for registration.",
  REGISTRATION_NOT_OPEN: "Registration has not opened yet.",
  REGISTRATION_CLOSED: "Registration is closed.",
  REGISTRATION_LOCKED: "This registration can no longer be edited. Contact the secretariat.",
  COMMITTEE_NOT_FOUND: "That committee is not available.",
  COMMITTEE_CLOSED: "That committee is closed.",
  COMMITTEE_FULL: "That committee has no portfolios remaining. Choose another committee.",
  COMMITTEE_REQUIRED: "Select a committee.",
  PREFERENCES_REQUIRED: "Select 2 or 3 committees in order of preference, with at least one portfolio each.",
  PREFERENCE_DUPLICATE: "Each committee can only be selected once.",
  PORTFOLIO_REQUIRED: "Select at least one portfolio for every preferred committee.",
  PORTFOLIO_DUPLICATE: "Do not enter the same portfolio twice for one committee.",
  ALLOCATION_PENDING: "Payment opens after the secretariat allocates your committee and portfolio.",
  ALLOCATION_REQUIRED: "Allocate a committee and portfolio first.",
  FOOD_REQUIRED: "Select a food preference.",
  PARTNER_REQUIRED: "Enter the signed-up email of your double-delegation partner.",
  PARTNER_SELF: "The partner email cannot be your own.",
  PARTNER_NOT_SIGNED_UP: "That partner has no account yet. They must sign up first.",
  PARTNER_BUSY: "That partner already has a registration that cannot be paired.",
  PARTNER_ALREADY_PAIRED: "That partner is already in another double delegation.",
  DELEGATION_NOT_ALLOWED: "That committee does not allow this delegation type.",
  OUTSTATION_FEE_REQUIRED: "Enter the fee for this outstation delegate.",
  FEE_INVALID: "Enter a valid fee amount.",
};

function rpcMessage(error: { message?: string } | null): string {
  const raw = (error?.message ?? "").toUpperCase();
  for (const [code, text] of Object.entries(RPC_MESSAGES)) {
    if (raw.includes(code)) return text;
  }
  return error?.message || "Something went wrong. Try again.";
}

function parseRegistration(data: unknown): Registration | null {
  if (!data || typeof data !== "object") return null;
  return data as Registration;
}

export async function startRegistrationAction(editionId: string): Promise<Registration | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_registration", { p_edition_id: editionId });
  if (error) {
    if (error.message?.includes("ALREADY_REGISTERED")) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const existing = await supabase
        .from("registrations")
        .select(
          "id, edition_id, user_id, committee_id, status, food_preference, expected_fee_minor, submitted_at, confirmed_at, accepted_rules_at, collective_id, delegation_type, partner_email, partner_registration_id, pair_id, is_pair_lead, is_outstation, outstation_student_type, outstation_needs_accommodation, outstation_check_in",
        )
        .eq("edition_id", editionId)
        .eq("user_id", user.id)
        .neq("status", "CANCELLED")
        .maybeSingle();
      return (existing.data as Registration | null) ?? null;
    }
    throw new Error(rpcMessage(error));
  }
  return parseRegistration(data);
}

function valuesPayload(
  fields: RegistrationFieldDefinition[],
  parsed: Record<string, unknown>,
) {
  return fields.map((field) => {
    const raw = parsed[field.field_key];
    if (field.field_type === "multiselect") {
      return {
        field_definition_id: field.id,
        value_text: null,
        value_json: Array.isArray(raw) ? raw : [],
      };
    }
    if (field.field_type === "boolean") {
      return {
        field_definition_id: field.id,
        value_text: raw ? "true" : "false",
        value_json: Boolean(raw),
      };
    }
    if (field.field_type === "number") {
      const asText = raw === "" || raw == null || Number.isNaN(raw) ? null : String(raw);
      return {
        field_definition_id: field.id,
        value_text: asText,
        value_json: asText == null ? null : Number(raw),
      };
    }
    return {
      field_definition_id: field.id,
      value_text: raw == null ? null : String(raw),
      value_json: null,
    };
  });
}

function parseFormPayload(formData: FormData, fields: RegistrationFieldDefinition[]) {
  const raw: Record<string, unknown> = {
    food_preference: String(formData.get("food_preference") ?? ""),
    collective_id: String(formData.get("collective_id") ?? ""),
    delegation_type: String(formData.get("delegation_type") ?? "SINGLE"),
    partner_email: String(formData.get("partner_email") ?? ""),
    is_outstation:
      formData.get("is_outstation") === "on" || formData.get("is_outstation") === "true",
    outstation_student_type: String(formData.get("outstation_student_type") ?? ""),
    outstation_needs_accommodation:
      formData.get("outstation_needs_accommodation") === "on" ||
      formData.get("outstation_needs_accommodation") === "true",
    outstation_check_in: String(formData.get("outstation_check_in") ?? ""),
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
  return raw;
}

async function runSave(
  intent: "draft" | "submit",
  formData: FormData,
): Promise<RegistrationState> {
  const registrationId = String(formData.get("registration_id") ?? "");
  const editionId = String(formData.get("edition_id") ?? "");
  if (!registrationId || !editionId || !isUuid(registrationId) || !isUuid(editionId)) {
    return { error: "Missing registration. Reload the page." };
  }

  const supabase = await createClient();
  const fieldsPromise = getFieldDefinitions(editionId);
  const rulesRowPromise =
    intent === "submit"
      ? supabase
          .from("registrations")
          .select("accepted_rules_at, is_pair_lead")
          .eq("id", registrationId)
          .maybeSingle()
      : Promise.resolve({ data: null as { accepted_rules_at?: string | null; is_pair_lead?: boolean } | null });

  const [fieldsAll, rulesRowResult] = await Promise.all([fieldsPromise, rulesRowPromise]);
  const fields = visibleRegistrationFields(fieldsAll);
  const raw = parseFormPayload(formData, fields);
  const prefItems = parsePreferencesFromForm(formData);

  const specialCrisisIds = new Set(
    String(formData.get("special_crisis_ids") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(isUuid),
  );
  // Fallback if the client omitted flags (older tabs / drafts).
  if (!specialCrisisIds.size) {
    const prefCommitteeIds = prefItems.map((pref) => pref.committee_id).filter(isUuid);
    if (prefCommitteeIds.length) {
      const { data: committeeRows } = await supabase
        .from("committees")
        .select("id, is_special_crisis")
        .in("id", prefCommitteeIds);
      for (const row of committeeRows ?? []) {
        if ((row as { is_special_crisis?: boolean }).is_special_crisis) {
          specialCrisisIds.add((row as { id: string }).id);
        }
      }
    }
  }

  if (intent === "submit") {
    const row = rulesRowResult.data;
    const readRulebook = formData.get("read_rulebook") === "on";
    const readGuidelines = formData.get("read_guidelines") === "on";
    const alreadyAccepted = Boolean(row?.accepted_rules_at);
    if (!alreadyAccepted && (!readRulebook || !readGuidelines)) {
      return { error: "Confirm that you have read both the rulebook and guidelines before submitting." };
    }
    if (!alreadyAccepted) {
      await supabase
        .from("registrations")
        .update({ accepted_rules_at: new Date().toISOString() })
        .eq("id", registrationId);
    }
    const isPairLead = row?.is_pair_lead !== false;
    const schema = buildRegistrationSchema(fields, {
      requirePreferences: isPairLead,
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
  } else if (prefItems.some((pref) => pref.committee_id && !isUuid(pref.committee_id))) {
    return { error: "Select valid committees", fieldErrors: { preferences: "Select committees" } };
  }

  const food = (raw.food_preference as string) || null;
  const foodPref =
    food === "VEG" || food === "NON_VEG" ? (food as FoodPreference) : null;
  const payload = valuesPayload(fields, raw);
  const prefs = preferencesPayloadForCommittees(prefItems, specialCrisisIds);
  const collectiveRaw = String(raw.collective_id ?? "").trim();
  const collectiveId = isUuid(collectiveRaw) ? collectiveRaw : null;
  const outstation = normalizeOutstationPayload({
    is_outstation: Boolean(raw.is_outstation),
    outstation_student_type: String(raw.outstation_student_type ?? ""),
    outstation_needs_accommodation: Boolean(raw.outstation_needs_accommodation),
    outstation_check_in: String(raw.outstation_check_in ?? ""),
  });
  if (intent === "submit") {
    if (outstation.is_outstation && !outstation.outstation_student_type) {
      return {
        error: "Select whether you are a school or college student.",
        fieldErrors: { outstation_student_type: "Select school or college." },
      };
    }
    if (outstation.is_outstation && outstation.outstation_needs_accommodation && !outstation.outstation_check_in) {
      return {
        error: "Select a check-in option for accommodation.",
        fieldErrors: { outstation_check_in: "Select a check-in option." },
      };
    }
  } else if (outstation.is_outstation && outstation.outstation_needs_accommodation && !outstation.outstation_check_in) {
    // Draft may tick accommodation before choosing check-in; keep the tick without violating DB.
    outstation.outstation_needs_accommodation = true;
    outstation.outstation_check_in = null;
  }

  const rpc = intent === "submit" ? "submit_registration" : "save_registration_draft";
  const { error } = await supabase.rpc(rpc, {
    p_registration_id: registrationId,
    p_food_preference: foodPref,
    p_values: payload,
    p_delegation_type: String(raw.delegation_type ?? "SINGLE") === "DOUBLE" ? "DOUBLE" : "SINGLE",
    p_partner_email: String(raw.partner_email ?? "").trim() || null,
    p_preferences: prefs,
  });

  if (error) return { error: rpcMessage(error) };

  const { error: metaError } = await supabase
    .from("registrations")
    .update({
      collective_id: collectiveId,
      ...outstation,
    })
    .eq("id", registrationId);
  if (metaError) return { error: metaError.message };

  // Keep revalidation narrow so the form remount stays fast.
  revalidatePath("/dashboard/register");
  revalidatePath("/dashboard");
  return {
    success:
      intent === "submit"
        ? "Registration submitted. The secretariat will allocate your committee and portfolio, then payment will open."
        : "Draft saved.",
  };
}

export async function saveDraftAction(
  _prev: RegistrationState,
  formData: FormData,
): Promise<RegistrationState> {
  return runSave("draft", formData);
}

export async function submitRegistrationAction(
  _prev: RegistrationState,
  formData: FormData,
): Promise<RegistrationState> {
  return runSave("submit", formData);
}

export async function registrationFormAction(
  _prev: RegistrationState,
  formData: FormData,
): Promise<RegistrationState> {
  const intent = String(formData.get("intent") ?? "draft") === "submit" ? "submit" : "draft";
  return runSave(intent, formData);
}

export async function updateProfileAction(
  _prev: RegistrationState,
  formData: FormData,
): Promise<RegistrationState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (fullName.length < 2) {
    return { error: "Name must be at least 2 characters", fieldErrors: { full_name: "Too short" } };
  }
  if (!isTenDigitPhone(phone)) {
    return { error: PHONE_ERROR, fieldErrors: { phone: PHONE_ERROR } };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to continue." };
  const { error } = await supabase
    .from("users")
    .update({ full_name: fullName, phone: phone || null })
    .eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { success: "Profile saved." };
}

export async function resendVerificationAction(
  prev: RegistrationState,
  formData: FormData,
): Promise<RegistrationState> {
  void prev;
  void formData;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "Sign in to continue." };
  const origin = await getAppOrigin();

  if (appMailConfigured()) {
    const { data: profile } = await supabase
      .from("users")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    const mail = await sendResendVerificationEmail({
      email: user.email,
      fullName: profile?.full_name,
      origin,
    });
    if (!mail.delivered) {
      return { error: mail.error ?? "Could not send verification email." };
    }
    return { success: "Verification email sent. Check your inbox (and spam)." };
  }

  const { error } = await supabase.auth.resend({
    type: "signup",
    email: user.email,
    options: { emailRedirectTo: `${origin}/auth/confirm?next=/dashboard` },
  });
  if (error) return { error: error.message };
  return { success: "Verification email sent. Locally it appears in Mailpit/Inbucket on port 54324." };
}
