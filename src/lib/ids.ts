import { z } from "zod";

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

/** Accepts Postgres uuids and local seed ids such as cccccccc-cccc-…. */
export const hexId = z.string().trim().refine((value) => isUuid(value), { error: "Invalid id." });

export const optionalHexId = z.union([z.literal(""), hexId]).optional();
