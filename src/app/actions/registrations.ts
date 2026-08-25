"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getFieldDefinitions } from "@/lib/data";
import { buildRegistrationSchema } from "@/lib/registration";
import type { FoodPreference, Registration, RegistrationFieldDefinition } from "@/types";

export type RegistrationState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: string;
};

const RPC_MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "Sign in to continue.",
  EMAIL_UNVERIFIED: "Verify your email before registering. Check Inbucket on port 54324 locally.",
  NOT_FOUND: "Registration not found.",
  ALREADY_REGISTERED: "You already have a registration for this edition.",
  EDITION_NOT_OPEN: "This edition is not open for registration.",
  REGISTRATION_NOT_OPEN: "Registration has not opened yet.",
  REGISTRATION_CLOSED: "Registration is closed.",
  REGISTRATION_LOCKED: "This registration can no longer be edited. Contact the secretariat.",
  COMMITTEE_NOT_FOUND: "That committee is not available.",
  COMMITTEE_CLOSED: "That committee is closed.",
  COMMITTEE_FULL: "That committee is full. Choose another committee.",
  COMMITTEE_REQUIRED: "Select a committee.",
  FOOD_REQUIRED: "Select a food preference.",
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
          "id, edition_id, user_id, committee_id, status, food_preference, expected_fee_minor, submitted_at, confirmed_at",
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
    committee_id: String(formData.get("committee_id") ?? ""),
    food_preference: String(formData.get("food_preference") ?? ""),
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
  if (!registrationId || !editionId) {
    return { error: "Missing registration. Reload the page." };
  }

  const fields = await getFieldDefinitions(editionId);
  const raw = parseFormPayload(formData, fields);

  if (intent === "submit") {
    const schema = buildRegistrationSchema(fields);
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
  } else {
    const committee = String(raw.committee_id ?? "");
    if (committee && !z.string().uuid().safeParse(committee).success) {
      return { error: "Select a valid committee", fieldErrors: { committee_id: "Select a committee" } };
    }
  }

  const food = (raw.food_preference as string) || null;
  const foodPref =
    food === "VEG" || food === "NON_VEG" ? (food as FoodPreference) : null;
  const committeeId = String(raw.committee_id ?? "") || null;
  const payload = valuesPayload(fields, raw);

  const supabase = await createClient();
  const rpc = intent === "submit" ? "submit_registration" : "save_registration_draft";
  const { error } = await supabase.rpc(rpc, {
    p_registration_id: registrationId,
    p_committee_id: committeeId,
    p_food_preference: foodPref,
    p_values: payload,
  });

  if (error) return { error: rpcMessage(error) };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/register");
  revalidatePath("/committees");
  return {
    success:
      intent === "submit"
        ? "Registration submitted. Pay from your dashboard."
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
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: user.email,
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  });
  if (error) return { error: error.message };
  return { success: "Verification email sent. Locally it appears in Inbucket on port 54324." };
}
