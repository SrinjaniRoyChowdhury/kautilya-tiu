"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { slugify } from "@/lib/format";
import { isStaffUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type FormState = {
  error?: string;
  success?: string;
};

const committeeSchema = z.object({
  edition_id: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  short_name: z.string().trim().min(2).max(16),
  slug: z.string().trim().max(40).optional().or(z.literal("")),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  rules_url: z.string().url().optional().or(z.literal("")),
  capacity: z.coerce.number().int().min(0).max(5000),
  fee_rupees: z.coerce.number().min(0).max(100000),
  status: z.enum(["OPEN", "CLOSED", "HIDDEN"]),
  display_order: z.coerce.number().int().min(0).max(999),
  eb_json: z.string().optional().or(z.literal("")),
  portfolio_config: z.string().optional().or(z.literal("")),
});

function parseJsonList(raw: string | undefined, kind: "eb" | "portfolio") {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("not array");
    return parsed;
  } catch {
    if (kind === "eb") {
      return raw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [name, title] = line.split("|").map((s) => s.trim());
          return { name, title: title || "Chair" };
        });
    }
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((name) => ({ name }));
  }
}

async function requireCommitteeManager() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/committees");
  const staff = await isStaffUser();
  if (!staff) redirect("/");
  const { data: allowed } = await supabase.rpc("has_permission", {
    p_code: "committee.manage",
    p_edition_id: null,
  });
  return { supabase, allowed: Boolean(allowed) };
}

export async function createCommitteeAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await requireCommitteeManager();
  if (!gate.allowed) return { error: "You do not have permission to manage committees." };

  const parsed = committeeSchema.safeParse({
    edition_id: formData.get("edition_id"),
    name: formData.get("name"),
    short_name: formData.get("short_name"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    rules_url: formData.get("rules_url"),
    capacity: formData.get("capacity"),
    fee_rupees: formData.get("fee_rupees"),
    status: formData.get("status"),
    display_order: formData.get("display_order") ?? 0,
    eb_json: formData.get("eb_json"),
    portfolio_config: formData.get("portfolio_config"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid committee" };

  const slug = parsed.data.slug
    ? slugify(parsed.data.slug)
    : slugify(parsed.data.short_name);

  const { data, error } = await gate.supabase
    .from("committees")
    .insert({
      edition_id: parsed.data.edition_id,
      name: parsed.data.name,
      short_name: parsed.data.short_name.toUpperCase(),
      slug,
      description: parsed.data.description || null,
      rules_url: parsed.data.rules_url || null,
      capacity: parsed.data.capacity,
      fee_minor: Math.round(parsed.data.fee_rupees * 100),
      status: parsed.data.status,
      display_order: parsed.data.display_order,
      eb_json: parseJsonList(parsed.data.eb_json, "eb"),
      portfolio_config: parseJsonList(parsed.data.portfolio_config, "portfolio"),
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Could not create committee" };

  await gate.supabase.rpc("write_audit", {
    p_action: "committee.create",
    p_entity: "committees",
    p_entity_id: data.id,
    p_old: null,
    p_new: { name: parsed.data.name, short_name: parsed.data.short_name },
  });

  revalidatePath("/committees");
  revalidatePath("/admin/committees");
  redirect(`/admin/committees/${data.id}`);
}

export async function updateCommitteeAction(
  committeeId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await requireCommitteeManager();
  if (!gate.allowed) return { error: "You do not have permission to manage committees." };

  const parsed = committeeSchema.safeParse({
    edition_id: formData.get("edition_id"),
    name: formData.get("name"),
    short_name: formData.get("short_name"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    rules_url: formData.get("rules_url"),
    capacity: formData.get("capacity"),
    fee_rupees: formData.get("fee_rupees"),
    status: formData.get("status"),
    display_order: formData.get("display_order") ?? 0,
    eb_json: formData.get("eb_json"),
    portfolio_config: formData.get("portfolio_config"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid committee" };

  const slug = parsed.data.slug
    ? slugify(parsed.data.slug)
    : slugify(parsed.data.short_name);

  const { error } = await gate.supabase
    .from("committees")
    .update({
      edition_id: parsed.data.edition_id,
      name: parsed.data.name,
      short_name: parsed.data.short_name.toUpperCase(),
      slug,
      description: parsed.data.description || null,
      rules_url: parsed.data.rules_url || null,
      capacity: parsed.data.capacity,
      fee_minor: Math.round(parsed.data.fee_rupees * 100),
      status: parsed.data.status,
      display_order: parsed.data.display_order,
      eb_json: parseJsonList(parsed.data.eb_json, "eb"),
      portfolio_config: parseJsonList(parsed.data.portfolio_config, "portfolio"),
    })
    .eq("id", committeeId);

  if (error) return { error: error.message };

  await gate.supabase.rpc("write_audit", {
    p_action: "committee.update",
    p_entity: "committees",
    p_entity_id: committeeId,
    p_old: null,
    p_new: { name: parsed.data.name, fee_rupees: parsed.data.fee_rupees },
  });

  revalidatePath("/committees");
  revalidatePath("/admin/committees");
  revalidatePath(`/admin/committees/${committeeId}`);
  return { success: "Committee saved. Existing registrations keep their snapshotted fee." };
}
