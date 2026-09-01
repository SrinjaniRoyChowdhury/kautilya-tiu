"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { DEFAULT_MEAL_TYPES, DEFAULT_REGISTRATION_FIELDS } from "@/lib/constants";
import { slugify } from "@/lib/format";
import { isStaffUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type FormState = {
  error?: string;
  success?: string;
};

const editionSchema = z.object({
  name: z.string().trim().min(3).max(120),
  year: z.coerce.number().int().min(2000).max(2100),
  slug: z.string().trim().min(2).max(40).optional().or(z.literal("")),
  theme: z.string().trim().max(160).optional().or(z.literal("")),
  start_date: z.string().optional().or(z.literal("")),
  end_date: z.string().optional().or(z.literal("")),
  registration_open_at: z.string().optional().or(z.literal("")),
  registration_close_at: z.string().optional().or(z.literal("")),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  is_public_active: z.coerce.boolean().optional(),
  registration_status: z.enum(["OPEN", "CLOSED"]).optional(),
});

async function requireEditionManager() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/editions");
  const staff = await isStaffUser();
  if (!staff) redirect("/");
  const { data: allowed } = await supabase.rpc("has_permission", {
    p_code: "edition.manage",
    p_edition_id: null,
  });
  if (!allowed) {
    return { supabase, user, allowed: false as const };
  }
  return { supabase, user, allowed: true as const };
}

async function seedEditionDefaults(
  supabase: Awaited<ReturnType<typeof createClient>>,
  editionId: string,
) {
  await supabase.from("registration_field_definitions").insert(
    DEFAULT_REGISTRATION_FIELDS.map((field) => ({
      edition_id: editionId,
      field_key: field.field_key,
      label: field.label,
      field_type: field.field_type,
      required: field.required,
      options: field.options,
      validation: field.validation,
      display_order: field.display_order,
      section: field.section,
    })),
  );

  const { data: meals } = await supabase
    .from("meal_types")
    .insert(
      DEFAULT_MEAL_TYPES.map((name, index) => ({
        edition_id: editionId,
        name,
        display_order: index + 1,
      })),
    )
    .select("id");

  if (meals?.length) {
    const schedules = [1, 2, 3].flatMap((day) =>
      meals.map((meal) => ({
        edition_id: editionId,
        event_day: day,
        meal_type_id: meal.id,
      })),
    );
    await supabase.from("meal_schedules").insert(schedules);
  }
}

export async function createEditionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await requireEditionManager();
  if (!gate.allowed) return { error: "You do not have permission to manage editions." };

  const parsed = editionSchema.safeParse({
    name: formData.get("name"),
    year: formData.get("year"),
    slug: formData.get("slug"),
    theme: formData.get("theme"),
    start_date: formData.get("start_date"),
    end_date: formData.get("end_date"),
    registration_open_at: formData.get("registration_open_at"),
    registration_close_at: formData.get("registration_close_at"),
    status: formData.get("status"),
    is_public_active: formData.get("is_public_active") === "on",
    registration_status: formData.has("registration_open_present")
      ? formData.get("registration_open") === "on"
        ? "OPEN"
        : "CLOSED"
      : formData.get("registration_status") === "CLOSED"
        ? "CLOSED"
        : "OPEN",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid edition" };

  const slug = parsed.data.slug ? slugify(parsed.data.slug) : String(parsed.data.year);
  const isPublicActive = Boolean(parsed.data.is_public_active);

  const { data, error } = await gate.supabase
    .from("mun_editions")
    .insert({
      name: parsed.data.name,
      year: parsed.data.year,
      slug,
      theme: parsed.data.theme || null,
      start_date: parsed.data.start_date || null,
      end_date: parsed.data.end_date || null,
      registration_open_at: parsed.data.registration_open_at
        ? new Date(parsed.data.registration_open_at).toISOString()
        : null,
      registration_close_at: parsed.data.registration_close_at
        ? new Date(parsed.data.registration_close_at).toISOString()
        : null,
      status: parsed.data.status,
      is_public_active: isPublicActive,
      registration_status: parsed.data.registration_status ?? "OPEN",
      created_by: gate.user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Could not create edition" };
  }

  await seedEditionDefaults(gate.supabase, data.id);
  await gate.supabase.rpc("ensure_edition_phases", { p_edition_id: data.id });
  await gate.supabase.rpc("write_audit", {
    p_action: "edition.create",
    p_entity: "mun_editions",
    p_entity_id: data.id,
    p_old: null,
    p_new: { name: parsed.data.name, year: parsed.data.year },
  });

  revalidatePath("/");
  revalidatePath("/admin/editions");
  revalidatePath("/editions");
  redirect(`/admin/editions/${data.id}`);
}

export async function updateEditionAction(
  editionId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await requireEditionManager();
  if (!gate.allowed) return { error: "You do not have permission to manage editions." };

  const parsed = editionSchema.safeParse({
    name: formData.get("name"),
    year: formData.get("year"),
    slug: formData.get("slug"),
    theme: formData.get("theme"),
    start_date: formData.get("start_date"),
    end_date: formData.get("end_date"),
    registration_open_at: formData.get("registration_open_at"),
    registration_close_at: formData.get("registration_close_at"),
    status: formData.get("status"),
    is_public_active: formData.get("is_public_active") === "on",
    registration_status: formData.has("registration_open_present")
      ? formData.get("registration_open") === "on"
        ? "OPEN"
        : "CLOSED"
      : formData.get("registration_status") === "CLOSED"
        ? "CLOSED"
        : "OPEN",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid edition" };

  const slug = parsed.data.slug ? slugify(parsed.data.slug) : String(parsed.data.year);

  const { error } = await gate.supabase
    .from("mun_editions")
    .update({
      name: parsed.data.name,
      year: parsed.data.year,
      slug,
      theme: parsed.data.theme || null,
      start_date: parsed.data.start_date || null,
      end_date: parsed.data.end_date || null,
      registration_open_at: parsed.data.registration_open_at
        ? new Date(parsed.data.registration_open_at).toISOString()
        : null,
      registration_close_at: parsed.data.registration_close_at
        ? new Date(parsed.data.registration_close_at).toISOString()
        : null,
      status: parsed.data.status,
      is_public_active: Boolean(parsed.data.is_public_active),
      registration_status: parsed.data.registration_status ?? "OPEN",
    })
    .eq("id", editionId);

  if (error) return { error: error.message };

  await gate.supabase.rpc("write_audit", {
    p_action: "edition.update",
    p_entity: "mun_editions",
    p_entity_id: editionId,
    p_old: null,
    p_new: { name: parsed.data.name, status: parsed.data.status },
  });

  revalidatePath("/");
  revalidatePath("/admin/editions");
  revalidatePath(`/admin/editions/${editionId}`);
  revalidatePath("/editions");
  return { success: "Edition saved." };
}

export async function archiveEditionAction(editionId: string): Promise<FormState> {
  const gate = await requireEditionManager();
  if (!gate.allowed) return { error: "You do not have permission to manage editions." };

  const { error } = await gate.supabase
    .from("mun_editions")
    .update({ status: "ARCHIVED", is_public_active: false })
    .eq("id", editionId);

  if (error) return { error: error.message };
  revalidatePath("/admin/editions");
  revalidatePath("/");
  return { success: "Edition archived." };
}
