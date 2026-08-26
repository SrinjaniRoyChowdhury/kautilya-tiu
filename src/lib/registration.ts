import { z, type ZodType } from "zod";
import { hexId } from "@/lib/ids";
import type { FieldSection, RegistrationFieldDefinition } from "@/types";

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

export function isRegistrationOpen(edition: {
  registration_open_at: string | null;
  registration_close_at: string | null;
  status: string;
}): "not_open" | "open" | "closed" {
  if (edition.status !== "PUBLISHED") return "closed";
  const now = Date.now();
  if (edition.registration_open_at && now < new Date(edition.registration_open_at).getTime()) {
    return "not_open";
  }
  if (edition.registration_close_at && now > new Date(edition.registration_close_at).getTime()) {
    return "closed";
  }
  return "open";
}

function parseOptions(options: RegistrationFieldDefinition["options"]): string[] {
  if (!options) return [];
  if (Array.isArray(options)) return options.map(String);
  return [];
}

function fieldSchema(def: RegistrationFieldDefinition): ZodType {
  const rules = def.validation ?? {};
  const options = parseOptions(def.options);

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

export function buildRegistrationSchema(fields: RegistrationFieldDefinition[]) {
  const shape: Record<string, ZodType> = {
    committee_id: hexId,
    food_preference: z.enum(["VEG", "NON_VEG"], { error: "Select a food preference" }),
    collective_id: z.union([hexId, z.literal("")]).optional(),
    delegation_type: z.enum(["SINGLE", "DOUBLE"]).optional(),
    partner_email: z.union([z.literal(""), z.string().trim().email("Enter a valid partner email")]).optional(),
  };
  for (const field of fields) {
    const def =
      field.field_key === "institution" ? { ...field, required: false } : field;
    shape[field.field_key] = fieldSchema(def);
  }
  return z.object(shape).superRefine((data, ctx) => {
    const collective = String(data.collective_id ?? "").trim();
    const institution = String(data.institution ?? "").trim();
    const inst = fields.find((field) => field.field_key === "institution");
    if (inst?.required && !collective && institution.length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["institution"],
        message: "Enter your institution, or select a collective.",
      });
    }
    if (String(data.delegation_type ?? "SINGLE") === "DOUBLE") {
      const email = String(data.partner_email ?? "").trim();
      if (!email) {
        ctx.addIssue({
          code: "custom",
          path: ["partner_email"],
          message: "Enter your partner's signed-up email.",
        });
      }
    }
  });
}

export type RegistrationFormValues = {
  committee_id: string;
  food_preference: "VEG" | "NON_VEG";
  collective_id?: string;
  delegation_type?: "SINGLE" | "DOUBLE";
  partner_email?: string;
  [key: string]: unknown;
};

export function seatsHeld(occupied: number | undefined, confirmed: number): number {
  return occupied ?? confirmed;
}
