import { z, type ZodType } from "zod";
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
    committee_id: z.string().uuid("Select a committee"),
    food_preference: z.enum(["VEG", "NON_VEG"], { error: "Select a food preference" }),
  };
  for (const field of fields) {
    shape[field.field_key] = fieldSchema(field);
  }
  return z.object(shape);
}

export type RegistrationFormValues = {
  committee_id: string;
  food_preference: "VEG" | "NON_VEG";
  [key: string]: unknown;
};

export function seatsHeld(occupied: number | undefined, confirmed: number): number {
  return occupied ?? confirmed;
}
