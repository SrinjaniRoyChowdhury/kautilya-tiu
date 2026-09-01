"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isStaffUser } from "@/lib/auth";
import { hexId, isUuid, optionalHexId } from "@/lib/ids";
import { toPlainText } from "@/lib/sanitize";
import { resolveSquareImageUpload, validateOptionalSquareImageFile } from "@/lib/cms-media";
import { proofExtension } from "@/lib/upload";
import { createAdminClient } from "@/lib/supabase/admin";
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
  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath("/about");
  revalidatePath("/team");
  revalidatePath("/contact");
  revalidatePath("/gallery");
  revalidatePath("/admin/cms");
  revalidatePath("/admin/team");
  revalidatePath("/admin/partners");
  revalidatePath("/api/announcements");
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
    { label: parsed.data.stat_label_1 ? toPlainText(parsed.data.stat_label_1) : "", value: parsed.data.stat_value_1 ? toPlainText(parsed.data.stat_value_1) : "" },
    { label: parsed.data.stat_label_2 ? toPlainText(parsed.data.stat_label_2) : "", value: parsed.data.stat_value_2 ? toPlainText(parsed.data.stat_value_2) : "" },
    { label: parsed.data.stat_label_3 ? toPlainText(parsed.data.stat_label_3) : "", value: parsed.data.stat_value_3 ? toPlainText(parsed.data.stat_value_3) : "" },
  ].filter((row) => row.label && row.value);

  const payload = {
    society_name: toPlainText(parsed.data.society_name),
    tagline: parsed.data.tagline ? toPlainText(parsed.data.tagline) : null,
    about_html: parsed.data.about_html ? toPlainText(parsed.data.about_html) : null,
    mission_html: parsed.data.mission_html ? toPlainText(parsed.data.mission_html) : null,
    history_html: parsed.data.history_html ? toPlainText(parsed.data.history_html) : null,
    contact_email: parsed.data.contact_email || null,
    contact_phone: parsed.data.contact_phone ? toPlainText(parsed.data.contact_phone) : null,
    contact_address: parsed.data.contact_address ? toPlainText(parsed.data.contact_address) : null,
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
  id: optionalHexId,
  edition_id: optionalHexId,
  title: z.string().trim().min(2).max(160),
  body_html: z.string().trim().min(1).max(8000),
  link_url: optionalUrl,
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
    id: String(formData.get("id") ?? ""),
    edition_id: String(formData.get("edition_id") ?? ""),
    title: formData.get("title"),
    body_html: formData.get("body_html"),
    link_url: formData.get("link_url"),
    display_order: formData.get("display_order"),
    published: formData.get("published") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid announcement" };

  const published = Boolean(parsed.data.published);
  const body = toPlainText(parsed.data.body_html);
  if (!body) return { error: "Enter announcement text as plain text." };
  const row = {
    edition_id: parsed.data.edition_id || null,
    title: toPlainText(parsed.data.title),
    body_html: body,
    link_url: parsed.data.link_url ? parsed.data.link_url.trim() : null,
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
  if (!isUuid(id)) return;
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

const teamSchema = z
  .object({
    id: optionalHexId,
    section: z.enum(["CORE", "USG"]),
    full_name: z.string().trim().max(160),
    role_title: z.string().trim().min(2).max(120),
    display_order: z.coerce.number().int().min(0).max(999),
    published: z.coerce.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.section === "CORE" && data.full_name.length < 2) {
      ctx.addIssue({ code: "custom", message: "Name is required for core officers.", path: ["full_name"] });
    }
  });

export async function saveTeamMemberAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await requireCms();
  if (!gate.allowed) return { error: "You need cms.manage to edit the team." };

  const parsed = teamSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    section: String(formData.get("section") ?? "CORE"),
    full_name: formData.get("full_name"),
    role_title: formData.get("role_title"),
    display_order: formData.get("display_order"),
    published: formData.get("published") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid team member" };

  const photoValidation = await validateOptionalSquareImageFile(formData, "photo_file");
  if (photoValidation) return { error: photoValidation };

  const admin = createAdminClient();
  const memberId = parsed.data.id;
  let currentPhoto: string | null = null;
  if (memberId) {
    const { data: existing } = await admin
      .from("cms_team_members")
      .select("photo_url")
      .eq("id", memberId)
      .maybeSingle();
    currentPhoto = existing?.photo_url ?? null;
  }

  const row = {
    edition_id: null,
    section: parsed.data.section,
    full_name: parsed.data.full_name,
    role_title: parsed.data.role_title,
    display_order: parsed.data.display_order,
    published: Boolean(parsed.data.published),
  };

  if (parsed.data.id) {
    const photo = await resolveSquareImageUpload(
      formData,
      "photo_file",
      "remove_photo",
      currentPhoto,
      (mime) => `team-photos/${parsed.data.id}.${proofExtension(mime!)}`,
    );
    if (photo.error) return { error: photo.error };

    const { error } = await gate.supabase
      .from("cms_team_members")
      .update({ ...row, photo_url: photo.url })
      .eq("id", parsed.data.id);
    if (error) return { error: error.message };
    await gate.supabase.rpc("write_audit", {
      p_action: "cms.team.update",
      p_entity: "cms_team_members",
      p_entity_id: parsed.data.id,
      p_old: null,
      p_new: { section: row.section, role_title: row.role_title, full_name: row.full_name },
    });
  } else {
    const { data, error } = await gate.supabase.from("cms_team_members").insert(row).select("id").single();
    if (error || !data) return { error: error?.message ?? "Could not add team member" };

    const photo = await resolveSquareImageUpload(
      formData,
      "photo_file",
      "remove_photo",
      null,
      (mime) => `team-photos/${data.id}.${proofExtension(mime!)}`,
    );
    if (photo.error) return { error: photo.error };
    if (photo.url) {
      const { error: photoError } = await gate.supabase
        .from("cms_team_members")
        .update({ photo_url: photo.url })
        .eq("id", data.id);
      if (photoError) return { error: photoError.message };
    }

    await gate.supabase.rpc("write_audit", {
      p_action: "cms.team.create",
      p_entity: "cms_team_members",
      p_entity_id: data.id,
      p_old: null,
      p_new: { section: row.section, role_title: row.role_title, full_name: row.full_name },
    });
  }
  revalidatePublic();
  return { success: parsed.data.section === "USG" ? "Department saved." : "Officer saved." };
}

export async function deleteTeamMemberAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await requireCms();
  if (!gate.allowed) return { error: "You need cms.manage to edit the team." };
  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) return { error: "Missing team member." };
  const { error } = await gate.supabase.from("cms_team_members").delete().eq("id", id);
  if (error) return { error: error.message };
  await gate.supabase.rpc("write_audit", {
    p_action: "cms.team.delete",
    p_entity: "cms_team_members",
    p_entity_id: id,
    p_old: null,
    p_new: null,
  });
  revalidatePublic();
  return { success: "Removed." };
}

const contactDeskFaceSchema = z.object({
  member_id: hexId,
  name: z.string().trim().min(1).max(80),
});

export async function updateContactDeskFacesAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await requireCms();
  if (!gate.allowed) return { error: "You need cms.manage to edit the contact desk." };

  const limitParsed = z.coerce.number().int().min(0).max(24).safeParse(formData.get("contact_desk_limit"));
  if (!limitParsed.success) return { error: "Display limit must be between 0 and 24." };

  const count = Number(formData.get("face_count") ?? 0);
  if (!Number.isFinite(count) || count < 0 || count > 48) {
    return { error: "Invalid desk face list." };
  }

  const faces: { member_id: string; name: string }[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < count; i++) {
    const member_id = String(formData.get(`face_member_${i}`) ?? "").trim();
    const name = String(formData.get(`face_name_${i}`) ?? "").trim();
    if (!member_id && !name) continue;
    const parsed = contactDeskFaceSchema.safeParse({ member_id, name });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid desk face." };
    const key = `${parsed.data.member_id}\0${parsed.data.name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    faces.push({
      member_id: parsed.data.member_id,
      name: toPlainText(parsed.data.name),
    });
  }

  const payload = {
    contact_desk_faces: faces,
    contact_desk_limit: limitParsed.data,
  };

  const { error } = await gate.supabase.from("site_settings").update(payload).eq("id", true);
  if (error) return { error: error.message };

  await gate.supabase.rpc("write_audit", {
    p_action: "cms.contact_desk.update",
    p_entity: "site_settings",
    p_entity_id: null,
    p_old: null,
    p_new: { limit: payload.contact_desk_limit, count: faces.length },
  });
  revalidatePublic();
  return { success: "Contact desk faces saved." };
}

const albumSchema = z.object({
  id: optionalHexId,
  edition_id: hexId,
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
    id: String(formData.get("id") ?? ""),
    edition_id: String(formData.get("edition_id") ?? ""),
    title: formData.get("title"),
    description: formData.get("description"),
    display_order: formData.get("display_order"),
    published: formData.get("published") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid album" };

  const row = {
    edition_id: parsed.data.edition_id,
    title: toPlainText(parsed.data.title),
    description: parsed.data.description ? toPlainText(parsed.data.description) : null,
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
  if (!isUuid(id)) return;
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
  album_id: hexId,
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
    album_id: String(formData.get("album_id") ?? ""),
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
      caption: parsed.data.caption ? toPlainText(parsed.data.caption) : null,
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
  if (!isUuid(id)) return;
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

const sponsorSchema = z.object({
  id: optionalHexId,
  name: z.string().trim().min(2).max(120),
  category: z.enum(["title", "gold", "silver", "partner"]),
  display_order: z.coerce.number().int().min(0).max(999),
  published: z.coerce.boolean().optional(),
});

const collaboratorSchema = z.object({
  id: optionalHexId,
  name: z.string().trim().min(2).max(120),
  category: z.enum(["society", "institution", "media", "partner"]),
  display_order: z.coerce.number().int().min(0).max(999),
  published: z.coerce.boolean().optional(),
});

async function savePartnerWithLogo(
  gate: { supabase: Awaited<ReturnType<typeof createClient>>; allowed: true },
  table: "cms_sponsors" | "cms_collaborators",
  parsed: { id?: string; name: string; category: string; display_order: number; published?: boolean },
  formData: FormData,
  logoPrefix: string,
  auditCreate: string,
  auditUpdate: string,
): Promise<FormState> {
  const logoValidation = await validateOptionalSquareImageFile(formData, "logo_file");
  if (logoValidation) return { error: logoValidation };

  const admin = createAdminClient();
  const rowId = parsed.id;
  let currentLogo: string | null = null;
  if (rowId) {
    const { data: existing } = await admin.from(table).select("logo_url").eq("id", rowId).maybeSingle();
    currentLogo = existing?.logo_url ?? null;
  }

  const row = {
    edition_id: null,
    name: toPlainText(parsed.name),
    category: parsed.category,
    display_order: parsed.display_order,
    published: Boolean(parsed.published),
  };

  if (parsed.id) {
    const logo = await resolveSquareImageUpload(
      formData,
      "logo_file",
      "remove_logo",
      currentLogo,
      (mime) => `${logoPrefix}/${parsed.id}.${proofExtension(mime!)}`,
    );
    if (logo.error) return { error: logo.error };

    const { error } = await gate.supabase
      .from(table)
      .update({ ...row, logo_url: logo.url })
      .eq("id", parsed.id);
    if (error) return { error: error.message };
    await gate.supabase.rpc("write_audit", {
      p_action: auditUpdate,
      p_entity: table,
      p_entity_id: parsed.id,
      p_old: null,
      p_new: { name: row.name, category: row.category },
    });
  } else {
    const { data, error } = await gate.supabase.from(table).insert(row).select("id").single();
    if (error || !data) return { error: error?.message ?? "Could not save entry" };

    const logo = await resolveSquareImageUpload(
      formData,
      "logo_file",
      "remove_logo",
      null,
      (mime) => `${logoPrefix}/${data.id}.${proofExtension(mime!)}`,
    );
    if (logo.error) return { error: logo.error };
    if (logo.url) {
      const { error: logoError } = await gate.supabase
        .from(table)
        .update({ logo_url: logo.url })
        .eq("id", data.id);
      if (logoError) return { error: logoError.message };
    }

    await gate.supabase.rpc("write_audit", {
      p_action: auditCreate,
      p_entity: table,
      p_entity_id: data.id,
      p_old: null,
      p_new: { name: row.name, category: row.category },
    });
  }

  revalidatePublic();
  return { success: "Saved." };
}

export async function saveSponsorAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const gate = await requireCms();
  if (!gate.allowed) return { error: "You need cms.manage to edit sponsors." };

  const parsed = sponsorSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    name: formData.get("name"),
    category: formData.get("category"),
    display_order: formData.get("display_order"),
    published: formData.get("published") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid sponsor" };

  return savePartnerWithLogo(
    gate,
    "cms_sponsors",
    parsed.data,
    formData,
    "sponsor-logos",
    "cms.sponsor.create",
    "cms.sponsor.update",
  );
}

export async function deleteSponsorAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const gate = await requireCms();
  if (!gate.allowed) return { error: "You need cms.manage to edit sponsors." };
  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) return { error: "Missing sponsor." };
  const { error } = await gate.supabase.from("cms_sponsors").delete().eq("id", id);
  if (error) return { error: error.message };
  await gate.supabase.rpc("write_audit", {
    p_action: "cms.sponsor.delete",
    p_entity: "cms_sponsors",
    p_entity_id: id,
    p_old: null,
    p_new: null,
  });
  revalidatePublic();
  return { success: "Removed." };
}

export async function saveCollaboratorAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const gate = await requireCms();
  if (!gate.allowed) return { error: "You need cms.manage to edit collaborators." };

  const parsed = collaboratorSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    name: formData.get("name"),
    category: formData.get("category"),
    display_order: formData.get("display_order"),
    published: formData.get("published") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid collaborator" };

  return savePartnerWithLogo(
    gate,
    "cms_collaborators",
    parsed.data,
    formData,
    "collaborator-logos",
    "cms.collaborator.create",
    "cms.collaborator.update",
  );
}

export async function deleteCollaboratorAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const gate = await requireCms();
  if (!gate.allowed) return { error: "You need cms.manage to edit collaborators." };
  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) return { error: "Missing collaborator." };
  const { error } = await gate.supabase.from("cms_collaborators").delete().eq("id", id);
  if (error) return { error: error.message };
  await gate.supabase.rpc("write_audit", {
    p_action: "cms.collaborator.delete",
    p_entity: "cms_collaborators",
    p_entity_id: id,
    p_old: null,
    p_new: null,
  });
  revalidatePublic();
  return { success: "Removed." };
}
