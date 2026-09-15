import { z, type ZodType } from "zod";
import { hexId } from "@/lib/ids";
import { isParticipantPhoneField, tenDigitPhoneSchema } from "@/lib/phone";
import type { FieldSection, RegistrationFieldDefinition, RegistrationPreference } from "@/types";
import { RETIRED_REGISTRATION_FIELD_KEYS } from "@/lib/constants";

export const SECTION_LABELS: Record<FieldSection, string> = {
  PERSONAL: "Personal",
  MUN_INFO: "MUN experience",
  FOOD: "Food",
  ADDITIONAL: "Additional",
};

export const PRE_PAYMENT_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "PAYMENT_PENDING",
  "PAYMENT_REJECTED",
] as const;

export const PRE_ALLOCATION_STATUSES = ["DRAFT", "SUBMITTED"] as const;

export const PAYABLE_STATUSES = ["PAYMENT_PENDING", "PAYMENT_REJECTED"] as const;

export function isPayableRegistration(status: string | null | undefined): boolean {
  return (PAYABLE_STATUSES as readonly string[]).includes(status ?? "");
}

export function isPreAllocationStatus(status: string | null | undefined): boolean {
  return (PRE_ALLOCATION_STATUSES as readonly string[]).includes(status ?? "");
}

export function needsConferenceRulesAcceptance(registration: {
  status: string;
  accepted_rules_at?: string | null;
}): boolean {
  if (registration.accepted_rules_at) return false;
  return registration.status === "DRAFT";
}

export function isRegistrationOpen(edition: {
  registration_open_at: string | null;
  registration_close_at: string | null;
  status: string;
  registration_status?: string | null;
}): "not_open" | "open" | "closed" {
  if (edition.status !== "PUBLISHED") return "closed";
  if (edition.registration_status === "CLOSED") return "closed";
  const now = Date.now();
  if (edition.registration_open_at && now < new Date(edition.registration_open_at).getTime()) {
    return "not_open";
  }
  if (edition.registration_close_at && now > new Date(edition.registration_close_at).getTime()) {
    return "closed";
  }
  return "open";
}

export function isCommitteeRegistrationLive(
  edition: {
    registration_open_at: string | null;
    registration_close_at: string | null;
    status: string;
    registration_status?: string | null;
  } | null | undefined,
  committee: {
    status: string;
  } | null | undefined,
): boolean {
  if (!edition || !committee) return false;
  if (committee.status !== "OPEN") return false;
  return isRegistrationOpen(edition) === "open";
}

function parseOptions(options: RegistrationFieldDefinition["options"]): string[] {
  if (!options) return [];
  if (Array.isArray(options)) return options.map(String);
  return [];
}

function fieldSchema(def: RegistrationFieldDefinition): ZodType {
  const rules = def.validation ?? {};
  const options = parseOptions(def.options);

  if (isParticipantPhoneField(def.field_key)) {
    return def.required
      ? tenDigitPhoneSchema
      : z.union([tenDigitPhoneSchema, z.literal("")]).optional();
  }

  switch (def.field_type) {
    case "number": {
      let schema: ZodType = z.coerce.number({ error: `${def.label} must be a number` });
      if (typeof rules.min === "number") {
        schema = (schema as z.ZodNumber).min(rules.min, `${def.label} must be at least ${rules.min}`);
      }
      if (typeof rules.max === "number") {
        schema = (schema as z.ZodNumber).max(rules.max, `${def.label} must be at most ${rules.max}`);
      }
      return def.required
        ? schema
        : z.union([schema, z.literal(""), z.nan()]).optional();
    }
    case "boolean":
      return def.required ? z.boolean() : z.boolean().optional();
    case "multiselect": {
      const arr = z.array(z.string());
      return def.required ? arr.min(1, `Select at least one for ${def.label}`) : arr.optional();
    }
    case "select": {
      const base =
        options.length > 0
          ? z.enum(options as [string, ...string[]], { error: `Choose ${def.label}` })
          : z.string();
      return def.required ? base : z.union([base, z.literal("")]).optional();
    }
    case "date":
    case "text":
    case "file": {
      let schema = z.string();
      if (def.required) schema = schema.min(1, `${def.label} is required`);
      if (typeof rules.min === "number") {
        schema = schema.min(rules.min, `${def.label} must be at least ${rules.min} characters`);
      }
      if (typeof rules.max === "number") {
        schema = schema.max(rules.max, `${def.label} must be at most ${rules.max} characters`);
      }
      if (rules.regex) {
        schema = schema.regex(new RegExp(rules.regex), `${def.label} is not in the expected format`);
      }
      return def.required ? schema : z.union([schema, z.literal("")]).optional();
    }
    default:
      return z.string().optional();
  }
}

export const preferenceItemSchema = z.object({
  committee_id: hexId,
  portfolio_1: z.union([z.string(), z.literal("")]).optional(),
  portfolio_2: z.union([z.string(), z.literal("")]).optional(),
});

export type PreferenceFormItem = z.infer<typeof preferenceItemSchema>;

export function visibleRegistrationFields(
  fields: RegistrationFieldDefinition[],
): RegistrationFieldDefinition[] {
  const retired = new Set<string>(RETIRED_REGISTRATION_FIELD_KEYS);
  return fields.filter((field) => !retired.has(field.field_key));
}

export function buildRegistrationSchema(
  fields: RegistrationFieldDefinition[],
  options: {
    requirePreferences?: boolean;
    specialCrisisCommitteeIds?: Iterable<string>;
  } = {},
) {
  const requirePreferences = options.requirePreferences !== false;
  const specialCrisis = new Set(options.specialCrisisCommitteeIds ?? []);
  const visible = visibleRegistrationFields(fields);
  const shape: Record<string, ZodType> = {
    food_preference: z.enum(["VEG", "NON_VEG"], { error: "Select a food preference" }),
    collective_id: z.union([hexId, z.literal("")]).optional(),
    delegation_type: z.enum(["SINGLE", "DOUBLE"]).optional(),
    partner_email: z.union([z.literal(""), z.string().trim().email("Enter a valid partner email")]).optional(),
    preferences: requirePreferences
      ? z
          .array(preferenceItemSchema)
          .min(2, "Select at least 2 committees in order of preference")
          .max(3, "Select at most 3 committees")
      : z.array(preferenceItemSchema).max(3).optional(),
  };
  for (const field of visible) {
    const def =
      field.field_key === "institution" || field.field_key === "mun_experience_details"
        ? { ...field, required: false }
        : field;
    shape[field.field_key] = fieldSchema(def);
  }
  return z.object(shape).superRefine((data, ctx) => {
    const collective = String(data.collective_id ?? "").trim();
    const institution = String(data.institution ?? "").trim();
    const inst = visible.find((field) => field.field_key === "institution");
    if (inst?.required && !collective && institution.length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["institution"],
        message: "Enter your institution, or select a collective.",
      });
    }
    if (String(data.delegation_type ?? "SINGLE") === "DOUBLE" && requirePreferences) {
      const email = String(data.partner_email ?? "").trim();
      if (!email) {
        ctx.addIssue({
          code: "custom",
          path: ["partner_email"],
          message: "Enter your partner's signed-up email.",
        });
      }
    }

    const prefs = Array.isArray(data.preferences) ? data.preferences : [];
    if (requirePreferences) {
      const seen = new Set<string>();
      prefs.forEach((pref, index) => {
        const id = String(pref.committee_id ?? "");
        if (seen.has(id)) {
          ctx.addIssue({
            code: "custom",
            path: ["preferences", index, "committee_id"],
            message: "Each committee can only be selected once.",
          });
        }
        seen.add(id);

        const isSpecial = specialCrisis.has(id);
        const p1 = String(pref.portfolio_1 ?? "").trim();
        const p2 = String(pref.portfolio_2 ?? "").trim();
        if (!isSpecial && !p1) {
          ctx.addIssue({
            code: "custom",
            path: ["preferences", index, "portfolio_1"],
            message: "Select at least one portfolio for this committee",
          });
        }
        if (!isSpecial && p2 && p1 && p1.toLowerCase() === p2.toLowerCase()) {
          ctx.addIssue({
            code: "custom",
            path: ["preferences", index, "portfolio_2"],
            message: "Use a different portfolio in the second field.",
          });
        }
      });
    }

    const experience = String(data.mun_experience ?? "").trim();
    const details = String(data.mun_experience_details ?? "").trim();
    if (experience && experience !== "None" && details.length < 3) {
      ctx.addIssue({
        code: "custom",
        path: ["mun_experience_details"],
        message: "Add details for your prior MUN experience.",
      });
    }
  });
}

export type RegistrationFormValues = {
  food_preference: "VEG" | "NON_VEG";
  collective_id?: string;
  delegation_type?: "SINGLE" | "DOUBLE";
  partner_email?: string;
  preferences: PreferenceFormItem[];
  [key: string]: unknown;
};

export function seatsHeld(occupied: number | undefined, confirmed: number): number {
  return occupied ?? confirmed;
}

export function preferencesToFormItems(
  rows: RegistrationPreference[],
  preferredCommitteeId?: string,
): PreferenceFormItem[] {
  const ordered = [...rows].sort((a, b) => a.preference_order - b.preference_order);
  if (ordered.length) {
    return ordered.map((row) => ({
      committee_id: row.committee_id,
      portfolio_1: row.portfolio_1 ?? "",
      portfolio_2: row.portfolio_2 ?? "",
    }));
  }
  if (preferredCommitteeId) {
    return [{ committee_id: preferredCommitteeId, portfolio_1: "", portfolio_2: "" }];
  }
  return [];
}

export function parsePreferencesFromForm(formData: FormData): PreferenceFormItem[] {
  const count = Number(formData.get("preference_count") ?? 0);
  const out: PreferenceFormItem[] = [];
  const n = Number.isFinite(count) ? Math.min(Math.max(Math.trunc(count), 0), 3) : 0;
  for (let i = 0; i < n; i += 1) {
    out.push({
      committee_id: String(formData.get(`preference_${i}_committee_id`) ?? ""),
      portfolio_1: String(formData.get(`preference_${i}_portfolio_1`) ?? ""),
      portfolio_2: String(formData.get(`preference_${i}_portfolio_2`) ?? ""),
    });
  }
  return out;
}

export function preferencesPayload(prefs: PreferenceFormItem[]) {
  return prefs
    .filter((pref) => pref.committee_id)
    .map((pref) => ({
      committee_id: pref.committee_id,
      portfolio_1: String(pref.portfolio_1 ?? "").trim(),
      portfolio_2: String(pref.portfolio_2 ?? "").trim() || null,
    }));
}

/** Clear stored portfolio text for special crisis committees before save. */
export function preferencesPayloadForCommittees(
  prefs: PreferenceFormItem[],
  specialCrisisCommitteeIds: Iterable<string>,
) {
  const special = new Set(specialCrisisCommitteeIds);
  return preferencesPayload(prefs).map((pref) =>
    special.has(pref.committee_id)
      ? { ...pref, portfolio_1: "", portfolio_2: null }
      : pref,
  );
}
