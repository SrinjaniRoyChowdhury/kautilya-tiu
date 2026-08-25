"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isStaffUser } from "@/lib/auth";
import { sanitizeHtml } from "@/lib/sanitize";
import { createClient } from "@/lib/supabase/server";

export type FormState = {
  error?: string;
  success?: string;
};

const optionalUrl = z.string().trim().url().optional().or(z.literal(""));

async function requireCms() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/cms");
  const staff = await isStaffUser();
  if (!staff) redirect("/");
  const { data: allowed } = await supabase.rpc("has_permission", {
    p_code: "cms.manage",
    p_edition_id: null,
  });
  if (!allowed) return { supabase, user, allowed: false as const };
  return { supabase, user, allowed: true as const };
}

function revalidatePublic() {
  revalidatePath("/");
  revalidatePath("/about");
  revalidatePath("/team");
  revalidatePath("/contact");
  revalidatePath("/gallery");
  revalidatePath("/admin/cms");
}

const settingsSchema = z.object({
  society_name: z.string().trim().min(2).max(80),
  tagline: z.string().trim().max(160).optional().or(z.literal("")),
  about_html: z.string().max(20000).optional().or(z.literal("")),
  mission_html: z.string().max(20000).optional().or(z.literal("")),
  history_html: z.string().max(20000).optional().or(z.literal("")),
  contact_email: z.string().trim().max(120).optional().or(z.literal("")),
  contact_phone: z.string().trim().max(40).optional().or(z.literal("")),
  contact_address: z.string().trim().max(240).optional().or(z.literal("")),
  instagram_url: optionalUrl,
  linkedin_url: optionalUrl,
  stat_label_1: z.string().trim().max(40).optional().or(z.literal("")),
  stat_value_1: z.string().trim().max(24).optional().or(z.literal("")),
  stat_label_2: z.string().trim().max(40).optional().or(z.literal("")),
  stat_value_2: z.string().trim().max(24).optional().or(z.literal("")),
  stat_label_3: z.string().trim().max(40).optional().or(z.literal("")),
  stat_value_3: z.string().trim().max(24).optional().or(z.literal("")),
});

export async function updateSiteSettingsAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await requireCms();
  if (!gate.allowed) return { error: "You need cms.manage to edit public content." };

  const parsed = settingsSchema.safeParse({
    society_name: formData.get("society_name"),
    tagline: formData.get("tagline"),
    about_html: formData.get("about_html"),
    mission_html: formData.get("mission_html"),
    history_html: formData.get("history_html"),
    contact_email: formData.get("contact_email"),
    contact_phone: formData.get("contact_phone"),
    contact_address: formData.get("contact_address"),
    instagram_url: formData.get("instagram_url"),
    linkedin_url: formData.get("linkedin_url"),
    stat_label_1: formData.get("stat_label_1"),
    stat_value_1: formData.get("stat_value_1"),
    stat_label_2: formData.get("stat_label_2"),
    stat_value_2: formData.get("stat_value_2"),
    stat_label_3: formData.get("stat_label_3"),
    stat_value_3: formData.get("stat_value_3"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid settings" };

  const hero_stats = [
    { label: parsed.data.stat_label_1, value: parsed.data.stat_value_1 },
    { label: parsed.data.stat_label_2, value: parsed.data.stat_value_2 },
    { label: parsed.data.stat_label_3, value: parsed.data.stat_value_3 },
  ].filter((row) => row.label && row.value);

  const payload = {
    society_name: parsed.data.society_name,
    tagline: parsed.data.tagline || null,
    about_html: parsed.data.about_html ? sanitizeHtml(parsed.data.about_html) : null,
    mission_html: parsed.data.mission_html ? sanitizeHtml(parsed.data.mission_html) : null,
    history_html: parsed.data.history_html ? sanitizeHtml(parsed.data.history_html) : null,
    contact_email: parsed.data.contact_email || null,
    contact_phone: parsed.data.contact_phone || null,
    contact_address: parsed.data.contact_address || null,
    instagram_url: parsed.data.instagram_url || null,
    linkedin_url: parsed.data.linkedin_url || null,
    hero_stats,
  };

  const { error } = await gate.supabase.from("site_settings").update(payload).eq("id", true);
  if (error) return { error: error.message };

  await gate.supabase.rpc("write_audit", {
    p_action: "cms.settings.update",
    p_entity: "site_settings",
    p_entity_id: null,
    p_old: null,
    p_new: { society_name: payload.society_name },
  });
  revalidatePublic();
  return { success: "Site copy saved. Public pages update immediately." };
}

const announcementSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  edition_id: z.string().uuid().optional().or(z.literal("")),
  title: z.string().trim().min(2).max(160),
  body_html: z.string().trim().min(1).max(8000),
  display_order: z.coerce.number().int().min(0).max(999),
  published: z.coerce.boolean().optional(),
});

export async function saveAnnouncementAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await requireCms();
  if (!gate.allowed) return { error: "You need cms.manage to edit announcements." };

  const parsed = announcementSchema.safeParse({
    id: formData.get("id"),
    edition_id: formData.get("edition_id"),
    title: formData.get("title"),
    body_html: formData.get("body_html"),
    display_order: formData.get("display_order"),
    published: formData.get("published") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid announcement" };

  const published = Boolean(parsed.data.published);
  const row = {
    edition_id: parsed.data.edition_id || null,
    title: parsed.data.title,
    body_html: sanitizeHtml(parsed.data.body_html),
    display_order: parsed.data.display_order,
    published,
    published_at: published ? new Date().toISOString() : null,
  };

  if (parsed.data.id) {
    const { data: existing } = await gate.supabase
      .from("announcements")
      .select("published_at")
      .eq("id", parsed.data.id)
      .maybeSingle();
    if (published && existing?.published_at) {
      row.published_at = existing.published_at as string;
    }
    const { error } = await gate.supabase.from("announcements").update(row).eq("id", parsed.data.id);
    if (error) return { error: error.message };
    await gate.supabase.rpc("write_audit", {
      p_action: "cms.announcement.update",
      p_entity: "announcements",
      p_entity_id: parsed.data.id,
      p_old: null,
      p_new: { title: row.title, published },
    });
  } else {
    const { data, error } = await gate.supabase.from("announcements").insert(row).select("id").single();
    if (error || !data) return { error: error?.message ?? "Could not create announcement" };
    await gate.supabase.rpc("write_audit", {
      p_action: "cms.announcement.create",
      p_entity: "announcements",
      p_entity_id: data.id,
      p_old: null,
      p_new: { title: row.title, published },
    });
  }

  revalidatePublic();
  return { success: published ? "Announcement published." : "Announcement saved as draft." };
}

export async function deleteAnnouncementAction(formData: FormData): Promise<void> {
  const gate = await requireCms();
  if (!gate.allowed) return;
  const id = String(formData.get("id") ?? "");
  if (!z.string().uuid().safeParse(id).success) return;
  await gate.supabase.from("announcements").delete().eq("id", id);
  await gate.supabase.rpc("write_audit", {
    p_action: "cms.announcement.delete",
    p_entity: "announcements",
    p_entity_id: id,
    p_old: null,
    p_new: null,
  });
  revalidatePublic();
}

const teamSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  edition_id: z.string().uuid().optional().or(z.literal("")),
  full_name: z.string().trim().min(2).max(120),
  role_title: z.string().trim().min(2).max(120),
  bio: z.string().trim().max(2000).optional().or(z.literal("")),
  photo_url: optionalUrl,
  display_order: z.coerce.number().int().min(0).max(999),
  published: z.coerce.boolean().optional(),
});

export async function saveTeamMemberAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await requireCms();
  if (!gate.allowed) return { error: "You need cms.manage to edit the team." };

  const parsed = teamSchema.safeParse({
    id: formData.get("id"),
    edition_id: formData.get("edition_id"),
    full_name: formData.get("full_name"),
    role_title: formData.get("role_title"),
    bio: formData.get("bio"),
    photo_url: formData.get("photo_url"),
    display_order: formData.get("display_order"),
    published: formData.get("published") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid team member" };

  const row = {
    edition_id: parsed.data.edition_id || null,
    full_name: parsed.data.full_name,
    role_title: parsed.data.role_title,
    bio: parsed.data.bio || null,
    photo_url: parsed.data.photo_url || null,
    display_order: parsed.data.display_order,
    published: Boolean(parsed.data.published),
  };

  if (parsed.data.id) {
    const { error } = await gate.supabase.from("cms_team_members").update(row).eq("id", parsed.data.id);
    if (error) return { error: error.message };
    await gate.supabase.rpc("write_audit", {
      p_action: "cms.team.update",
      p_entity: "cms_team_members",
      p_entity_id: parsed.data.id,
      p_old: null,
      p_new: { full_name: row.full_name },
    });
  } else {
    const { data, error } = await gate.supabase.from("cms_team_members").insert(row).select("id").single();
    if (error || !data) return { error: error?.message ?? "Could not add team member" };
    await gate.supabase.rpc("write_audit", {
      p_action: "cms.team.create",
      p_entity: "cms_team_members",
      p_entity_id: data.id,
      p_old: null,
      p_new: { full_name: row.full_name },
    });
  }
  revalidatePublic();
  return { success: "Team member saved." };
}

export async function deleteTeamMemberAction(formData: FormData): Promise<void> {
  const gate = await requireCms();
  if (!gate.allowed) return;
  const id = String(formData.get("id") ?? "");
  if (!z.string().uuid().safeParse(id).success) return;
  await gate.supabase.from("cms_team_members").delete().eq("id", id);
  await gate.supabase.rpc("write_audit", {
    p_action: "cms.team.delete",
    p_entity: "cms_team_members",
    p_entity_id: id,
    p_old: null,
    p_new: null,
  });
  revalidatePublic();
}

const albumSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  edition_id: z.string().uuid(),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  display_order: z.coerce.number().int().min(0).max(999),
  published: z.coerce.boolean().optional(),
});

export async function saveGalleryAlbumAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await requireCms();
  if (!gate.allowed) return { error: "You need cms.manage to edit the gallery." };

  const parsed = albumSchema.safeParse({
    id: formData.get("id"),
    edition_id: formData.get("edition_id"),
    title: formData.get("title"),
    description: formData.get("description"),
    display_order: formData.get("display_order"),
    published: formData.get("published") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid album" };

  const row = {
    edition_id: parsed.data.edition_id,
    title: parsed.data.title,
    description: parsed.data.description || null,
    display_order: parsed.data.display_order,
    published: Boolean(parsed.data.published),
  };

  if (parsed.data.id) {
    const { error } = await gate.supabase.from("gallery_albums").update(row).eq("id", parsed.data.id);
    if (error) return { error: error.message };
    await gate.supabase.rpc("write_audit", {
      p_action: "cms.gallery.album.update",
      p_entity: "gallery_albums",
      p_entity_id: parsed.data.id,
      p_old: null,
      p_new: { title: row.title, published: row.published },
    });
  } else {
    const { data, error } = await gate.supabase.from("gallery_albums").insert(row).select("id").single();
    if (error || !data) return { error: error?.message ?? "Could not create album" };
    await gate.supabase.rpc("write_audit", {
      p_action: "cms.gallery.album.create",
      p_entity: "gallery_albums",
      p_entity_id: data.id,
      p_old: null,
      p_new: { title: row.title },
    });
  }
  revalidatePublic();
  return { success: "Album saved." };
}

export async function deleteGalleryAlbumAction(formData: FormData): Promise<void> {
  const gate = await requireCms();
  if (!gate.allowed) return;
  const id = String(formData.get("id") ?? "");
  if (!z.string().uuid().safeParse(id).success) return;
  await gate.supabase.from("gallery_albums").delete().eq("id", id);
  await gate.supabase.rpc("write_audit", {
    p_action: "cms.gallery.album.delete",
    p_entity: "gallery_albums",
    p_entity_id: id,
    p_old: null,
    p_new: null,
  });
  revalidatePublic();
}

const imageSchema = z.object({
  album_id: z.string().uuid(),
  storage_key: z.string().trim().url().max(500),
  caption: z.string().optional().or(z.literal("")),
  display_order: z.coerce.number().int().min(0).max(999),
});

export async function addGalleryImageAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await requireCms();
  if (!gate.allowed) return { error: "You need cms.manage to edit the gallery." };

  const parsed = imageSchema.safeParse({
    album_id: formData.get("album_id"),
    storage_key: formData.get("storage_key"),
    caption: formData.get("caption"),
    display_order: formData.get("display_order") || 0,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid image URL" };

  const { data, error } = await gate.supabase
    .from("gallery_images")
    .insert({
      album_id: parsed.data.album_id,
      storage_key: parsed.data.storage_key,
      caption: parsed.data.caption || null,
      display_order: parsed.data.display_order,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not add image" };

  await gate.supabase.rpc("write_audit", {
    p_action: "cms.gallery.image.create",
    p_entity: "gallery_images",
    p_entity_id: data.id,
    p_old: null,
    p_new: { album_id: parsed.data.album_id },
  });
  revalidatePublic();
  return { success: "Image added." };
}

export async function deleteGalleryImageAction(formData: FormData): Promise<void> {
  const gate = await requireCms();
  if (!gate.allowed) return;
  const id = String(formData.get("id") ?? "");
  if (!z.string().uuid().safeParse(id).success) return;
  await gate.supabase.from("gallery_images").delete().eq("id", id);
  await gate.supabase.rpc("write_audit", {
    p_action: "cms.gallery.image.delete",
    p_entity: "gallery_images",
    p_entity_id: id,
    p_old: null,
    p_new: null,
  });
  revalidatePublic();
}
