"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { slugify } from "@/lib/format";
import { hasPermission, isStaffUser } from "@/lib/auth";
import { hexId, isUuid } from "@/lib/ids";
import { rupeesFromForm, PHASE_KINDS } from "@/lib/phases";
import { toPlainText } from "@/lib/sanitize";
import { parsePortfolioMatrix, parsePortfoliosText, type PortfolioRow } from "@/lib/sheet";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { proofExtension, sniffImageMime, validateCommitteeLogoBytes } from "@/lib/upload";

export type CommitteeFormValues = {
  edition_id: string;
  name: string;
  short_name: string;
  slug: string;
  status: string;
  display_order: number;
  description: string;
  eb_json: string;
  allows_single_del: boolean;
  allows_double_del: boolean;
  phase_fees: Record<string, { single: string; double: string }>;
};

export type FormState = {
  error?: string;
  success?: string;
  values?: CommitteeFormValues;
  formKey?: string;
};

const MAX_PORTFOLIO_BYTES = 2 * 1024 * 1024;

const committeeSchema = z.object({
  edition_id: hexId,
  name: z.string().trim().min(2).max(120),
  short_name: z.string().trim().min(2).max(16),
  slug: z.string().trim().max(40).optional().or(z.literal("")),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  rules_url: z.string().url().optional().or(z.literal("")),
  fee_rupees: z.coerce.number().min(0).max(100000).optional(),
  allows_single_del: z.coerce.boolean().optional(),
  allows_double_del: z.coerce.boolean().optional(),
  status: z.enum(["OPEN", "CLOSED", "HIDDEN"]),
  display_order: z.coerce.number().int().min(0).max(999),
  eb_json: z.string().optional().or(z.literal("")),
  portfolio_config: z.string().optional().or(z.literal("")),
});

const COMMITTEE_FIELD_LABELS: Record<string, string> = {
  edition_id: "Edition",
  name: "Full name",
  short_name: "Short name",
  slug: "Slug",
  description: "Description",
  rules_url: "Rules URL",
  status: "Status",
  display_order: "Display order",
  eb_json: "Executive board",
};

function readCommitteeDraft(formData: FormData): CommitteeFormValues {
  const phase_fees: CommitteeFormValues["phase_fees"] = {};
  for (const kind of PHASE_KINDS) {
    phase_fees[kind] = {
      single: String(formData.get(`fee_${kind}_single`) ?? ""),
      double: String(formData.get(`fee_${kind}_double`) ?? ""),
    };
  }
  return {
    edition_id: String(formData.get("edition_id") ?? ""),
    name: String(formData.get("name") ?? ""),
    short_name: String(formData.get("short_name") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    status: String(formData.get("status") ?? "OPEN"),
    display_order: Number(formData.get("display_order") ?? 0),
    description: String(formData.get("description") ?? ""),
    eb_json: String(formData.get("eb_json") ?? ""),
    allows_single_del: formData.get("allows_single_del") === "on",
    allows_double_del: formData.get("allows_double_del") === "on",
    phase_fees,
  };
}

function failCommittee(formData: FormData, error: string): FormState {
  return { error, values: readCommitteeDraft(formData), formKey: String(Date.now()) };
}

function formatCommitteeZodError(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Check the committee form.";
  const field = COMMITTEE_FIELD_LABELS[String(issue.path[0])] ?? String(issue.path[0] || "Field");
  return `${field}: ${issue.message}`;
}

function parseEb(raw: string | undefined) {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const row = item as { name?: string; title?: string };
        const name = toPlainText(row.name);
        if (!name) return [];
        return [{ name, title: toPlainText(row.title) || "Chair" }];
      });
    }
  } catch {
    /* line format */
  }
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const [name, title] = line.split("|").map((s) => s.trim());
      const cleanName = toPlainText(name);
      if (!cleanName) return [];
      return [{ name: cleanName, title: toPlainText(title) || "Chair" }];
    });
}

async function portfoliosFromForm(formData: FormData): Promise<{ rows: PortfolioRow[]; error?: string }> {
  const file = formData.get("portfolio_file");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_PORTFOLIO_BYTES) return { rows: [], error: "Spreadsheet must be 2 MB or smaller." };
    const rows = parsePortfolioMatrix(new Uint8Array(await file.arrayBuffer()));
    if (!rows.length) return { rows: [], error: "No portfolios found. Use columns SLR No. and Portfolio." };
    return { rows };
  }
  return { rows: parsePortfoliosText(String(formData.get("portfolio_config") ?? "")) };
}

async function uploadCommitteeLogoBytes(
  committeeId: string,
  buffer: Buffer,
): Promise<{ logoUrl: string | null; error?: string }> {
  const bytes = new Uint8Array(buffer);
  const dimError = validateCommitteeLogoBytes(bytes);
  if (dimError) return { logoUrl: null, error: dimError };
  const mime = sniffImageMime(bytes);
  if (!mime) return { logoUrl: null, error: "Logo: use JPEG, PNG, or WebP." };
  const key = `committee-logos/${committeeId}.${proofExtension(mime)}`;
  const admin = createAdminClient();
  const upload = await admin.storage.from("cms-media").upload(key, buffer, {
    contentType: mime,
    upsert: true,
  });
  if (upload.error) return { logoUrl: null, error: "Logo: could not store the image." };
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
  return { logoUrl: `${base}/storage/v1/object/public/cms-media/${key}` };
}

async function resolveCommitteeLogo(
  committeeId: string,
  formData: FormData,
  currentLogoUrl: string | null,
): Promise<{ logoUrl: string | null; error?: string }> {
  if (formData.get("remove_logo") === "on") return { logoUrl: null };
  const file = formData.get("logo_file");
  if (!(file instanceof File) || file.size === 0) return { logoUrl: currentLogoUrl };
  const buffer = Buffer.from(await file.arrayBuffer());
  return uploadCommitteeLogoBytes(committeeId, buffer);
}

async function validateOptionalCommitteeLogoFile(formData: FormData): Promise<string | null> {
  const file = formData.get("logo_file");
  if (!(file instanceof File) || file.size === 0) return null;
  const buffer = Buffer.from(await file.arrayBuffer());
  return validateCommitteeLogoBytes(new Uint8Array(buffer));
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

async function upsertCommitteeFees(
  supabase: Awaited<ReturnType<typeof createClient>>,
  committeeId: string,
  editionId: string,
  formData: FormData,
  fallbackRupees: number,
) {
  await supabase.rpc("ensure_edition_phases", { p_edition_id: editionId });
  const { data: phases } = await supabase
    .from("registration_phases")
    .select("id, kind, is_active")
    .eq("edition_id", editionId);
  let activeSingle = rupeesFromForm(fallbackRupees);
  for (const phase of (phases as Array<{ id: string; kind: string; is_active: boolean }> | null) ?? []) {
    const single = rupeesFromForm(formData.get(`fee_${phase.kind}_single`), rupeesFromForm(fallbackRupees));
    const double = rupeesFromForm(formData.get(`fee_${phase.kind}_double`), single);
    await supabase.from("committee_phase_fees").upsert(
      {
        committee_id: committeeId,
        phase_id: phase.id,
        single_fee_minor: single,
        double_fee_minor: double,
      },
      { onConflict: "committee_id,phase_id" },
    );
    if (phase.is_active) activeSingle = single;
  }
  await supabase.from("committees").update({ fee_minor: activeSingle }).eq("id", committeeId);
}

function revalidateCommittee(committeeId?: string) {
  revalidatePath("/committees");
  revalidatePath("/admin/committees");
  revalidatePath("/admin/committees/eb");
  revalidatePath("/executive-board");
  revalidatePath("/admin/credentials");
  revalidatePath("/admin/reports");
  revalidatePath("/dashboard/qr");
  if (committeeId) revalidatePath(`/admin/committees/${committeeId}`);
}

export async function createCommitteeAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await requireCommitteeManager();
  if (!gate.allowed) return failCommittee(formData, "You do not have permission to manage committees.");

  const parsed = committeeSchema.safeParse({
    edition_id: String(formData.get("edition_id") ?? ""),
    name: formData.get("name"),
    short_name: formData.get("short_name"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    rules_url: String(formData.get("rules_url") ?? ""),
    fee_rupees: formData.get("fee_rupees"),
    status: formData.get("status"),
    display_order: formData.get("display_order") ?? 0,
    eb_json: formData.get("eb_json"),
    portfolio_config: String(formData.get("portfolio_config") ?? ""),
  });
  if (!parsed.success) return failCommittee(formData, formatCommitteeZodError(parsed.error));

  const allowsSingle = formData.get("allows_single_del") === "on";
  const allowsDouble = formData.get("allows_double_del") === "on";
  if (!allowsSingle && !allowsDouble) {
    return failCommittee(
      formData,
      "Delegation type: allow single delegation, double delegation, or both.",
    );
  }
  const fallbackRupees = Number(formData.get("fee_EARLY_BIRD_single") || formData.get("fee_rupees") || 1500);

  const portfolios = await portfoliosFromForm(formData);
  if (portfolios.error) return failCommittee(formData, portfolios.error);

  const logoValidation = await validateOptionalCommitteeLogoFile(formData);
  if (logoValidation) return failCommittee(formData, logoValidation);

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
      description: parsed.data.description ? toPlainText(parsed.data.description) : null,
      rules_url: parsed.data.rules_url || null,
      capacity: portfolios.rows.length,
      fee_minor: rupeesFromForm(fallbackRupees),
      allows_single_del: allowsSingle,
      allows_double_del: allowsDouble,
      status: parsed.data.status,
      display_order: parsed.data.display_order,
      eb_json: parseEb(parsed.data.eb_json),
      portfolio_config: portfolios.rows,
    })
    .select("id")
    .single();

  if (error || !data) return failCommittee(formData, error?.message ?? "Could not create committee");

  const logo = await resolveCommitteeLogo(data.id, formData, null);
  if (logo.error) return failCommittee(formData, logo.error);
  if (logo.logoUrl) {
    const { error: logoError } = await gate.supabase
      .from("committees")
      .update({ logo_url: logo.logoUrl })
      .eq("id", data.id);
    if (logoError) return failCommittee(formData, logoError.message);
  }

  await upsertCommitteeFees(gate.supabase, data.id, parsed.data.edition_id, formData, fallbackRupees);
  await gate.supabase.rpc("write_audit", {
    p_action: "committee.create",
    p_entity: "committees",
    p_entity_id: data.id,
    p_old: null,
    p_new: { name: parsed.data.name, short_name: parsed.data.short_name, delegations: portfolios.rows.length },
  });

  revalidateCommittee(data.id);
  redirect(`/admin/committees/${data.id}`);
}

export async function updateCommitteeAction(
  committeeId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await requireCommitteeManager();
  if (!gate.allowed) return failCommittee(formData, "You do not have permission to manage committees.");

  const parsed = committeeSchema.safeParse({
    edition_id: String(formData.get("edition_id") ?? ""),
    name: formData.get("name"),
    short_name: formData.get("short_name"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    rules_url: String(formData.get("rules_url") ?? ""),
    fee_rupees: formData.get("fee_rupees"),
    status: formData.get("status"),
    display_order: formData.get("display_order") ?? 0,
    eb_json: formData.get("eb_json"),
  });
  if (!parsed.success) return failCommittee(formData, formatCommitteeZodError(parsed.error));

  const allowsSingle = formData.get("allows_single_del") === "on";
  const allowsDouble = formData.get("allows_double_del") === "on";
  if (!allowsSingle && !allowsDouble) {
    return failCommittee(
      formData,
      "Delegation type: allow single delegation, double delegation, or both.",
    );
  }
  const fallbackRupees = Number(formData.get("fee_EARLY_BIRD_single") || formData.get("fee_rupees") || 1500);

  const slug = parsed.data.slug
    ? slugify(parsed.data.slug)
    : slugify(parsed.data.short_name);

  const { data: current } = await gate.supabase
    .from("committees")
    .select("logo_url")
    .eq("id", committeeId)
    .maybeSingle();
  const logo = await resolveCommitteeLogo(committeeId, formData, current?.logo_url ?? null);
  if (logo.error) return failCommittee(formData, logo.error);

  const { error } = await gate.supabase
    .from("committees")
    .update({
      edition_id: parsed.data.edition_id,
      name: parsed.data.name,
      short_name: parsed.data.short_name.toUpperCase(),
      slug,
      description: parsed.data.description ? toPlainText(parsed.data.description) : null,
      rules_url: parsed.data.rules_url || null,
      logo_url: logo.logoUrl,
      fee_minor: rupeesFromForm(fallbackRupees),
      allows_single_del: allowsSingle,
      allows_double_del: allowsDouble,
      status: parsed.data.status,
      display_order: parsed.data.display_order,
    })
    .eq("id", committeeId);

  if (error) return failCommittee(formData, error.message);

  await upsertCommitteeFees(gate.supabase, committeeId, parsed.data.edition_id, formData, fallbackRupees);

  await gate.supabase.rpc("write_audit", {
    p_action: "committee.update",
    p_entity: "committees",
    p_entity_id: committeeId,
    p_old: null,
    p_new: { name: parsed.data.name },
  });

  revalidateCommittee(committeeId);
  return { success: "Committee saved. Existing registrations keep their snapshotted fee." };
}

const contentSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
});

const ebSchema = z.object({
  eb_json: z.string().optional().or(z.literal("")),
});

export async function updateCommitteeContentAction(
  committeeId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isUuid(committeeId)) return { error: "Missing committee." };
  const canContent = await hasPermission("committee.content");
  const canManage = await hasPermission("committee.manage");
  if (!canContent && !canManage) {
    return { error: "You can only edit committee name, description, and logo." };
  }

  const parsed = contentSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid committee" };

  const admin = createAdminClient();
  const { data: current } = await admin.from("committees").select("logo_url").eq("id", committeeId).maybeSingle();
  const logo = await resolveCommitteeLogo(committeeId, formData, current?.logo_url ?? null);
  if (logo.error) return { error: logo.error };

  const { error } = await admin
    .from("committees")
    .update({
      name: parsed.data.name,
      description: parsed.data.description ? toPlainText(parsed.data.description) : null,
      logo_url: logo.logoUrl,
    })
    .eq("id", committeeId);
  if (error) return { error: error.message };

  await admin.rpc("write_audit", {
    p_action: "committee.content_update",
    p_entity: "committees",
    p_entity_id: committeeId,
    p_old: null,
    p_new: { name: parsed.data.name },
  });
  revalidateCommittee(committeeId);
  return { success: "Committee public details saved." };
}

export async function updateCommitteeEbAction(
  committeeId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!isUuid(committeeId)) return { error: "Missing committee." };
  const canContent = await hasPermission("committee.content");
  const canManage = await hasPermission("committee.manage");
  if (!canContent && !canManage) {
    return { error: "You do not have permission to edit executive boards." };
  }

  const parsed = ebSchema.safeParse({ eb_json: formData.get("eb_json") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid executive board" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("committees")
    .update({ eb_json: parseEb(parsed.data.eb_json) })
    .eq("id", committeeId);
  if (error) return { error: error.message };

  await admin.rpc("write_audit", {
    p_action: "committee.eb_update",
    p_entity: "committees",
    p_entity_id: committeeId,
    p_old: null,
    p_new: { eb_count: parseEb(parsed.data.eb_json).length },
  });
  revalidateCommittee(committeeId);
  revalidatePath("/executive-board");
  revalidatePath("/admin/committees/eb");
  return { success: "Executive board saved." };
}

export async function uploadCommitteePortfoliosAction(
  committeeId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const gate = await requireCommitteeManager();
  if (!gate.allowed) return { error: "You do not have permission to manage committees." };
  if (!isUuid(committeeId)) return { error: "Missing committee." };

  const file = formData.get("portfolio_file");
  if (!(file instanceof File) || file.size === 0) return { error: "Upload an Excel or CSV file." };
  if (file.size > MAX_PORTFOLIO_BYTES) return { error: "Spreadsheet must be 2 MB or smaller." };
  const rows = parsePortfolioMatrix(new Uint8Array(await file.arrayBuffer()));
  if (!rows.length) return { error: "No portfolios found. Use columns SLR No. and Portfolio." };

  const { error } = await gate.supabase
    .from("committees")
    .update({ portfolio_config: rows, capacity: rows.length })
    .eq("id", committeeId);
  if (error) return { error: error.message };

  await gate.supabase.rpc("write_audit", {
    p_action: "committee.portfolios",
    p_entity: "committees",
    p_entity_id: committeeId,
    p_old: null,
    p_new: { delegations: rows.length },
  });
  revalidateCommittee(committeeId);
  return { success: `${rows.length} delegations loaded from the spreadsheet.` };
}

export async function assignDelegationAction(
  committeeId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const allowed = await hasPermission("committee.manage");
  if (!allowed) return { error: "You do not have permission to allocate delegations." };
  if (!isUuid(committeeId)) return { error: "Missing committee." };

  const slr = Number(formData.get("slr"));
  const portfolio = String(formData.get("portfolio") ?? "").trim();
  const registrationId = String(formData.get("registration_id") ?? "").trim();
  if (!Number.isInteger(slr) || slr < 1) return { error: "Missing SLR number." };
  if (!portfolio) return { error: "Missing portfolio." };

  const admin = createAdminClient();
  const { data: committee } = await admin
    .from("committees")
    .select("id")
    .eq("id", committeeId)
    .maybeSingle();
  if (!committee) return { error: "Committee not found." };

  await admin
    .from("registrations")
    .update({ allocated_slr: null, allocated_portfolio: null })
    .eq("committee_id", committeeId)
    .eq("allocated_slr", slr);

  if (!registrationId) {
    revalidateCommittee(committeeId);
    return { success: "Delegation cleared." };
  }
  if (!isUuid(registrationId)) return { error: "Choose a delegate." };

  const { data: registration, error: foundError } = await admin
    .from("registrations")
    .select("id, committee_id, partner_registration_id")
    .eq("id", registrationId)
    .maybeSingle();
  if (foundError || !registration || registration.committee_id !== committeeId) {
    return { error: "That delegate is not in this committee." };
  }

  const { error } = await admin
    .from("registrations")
    .update({ allocated_slr: slr, allocated_portfolio: portfolio })
    .eq("id", registrationId)
    .eq("committee_id", committeeId);
  if (error) return { error: error.message };
  if (registration.partner_registration_id) {
    const { error: partnerError } = await admin
      .from("registrations")
      .update({ allocated_slr: slr, allocated_portfolio: portfolio })
      .eq("id", registration.partner_registration_id);
    if (partnerError) return { error: partnerError.message };
  }

  const supabase = await createClient();
  await supabase.rpc("write_audit", {
    p_action: "committee.allocate",
    p_entity: "registrations",
    p_entity_id: registrationId,
    p_old: null,
    p_new: { committee_id: committeeId, allocated_slr: slr, allocated_portfolio: portfolio },
  });
  revalidateCommittee(committeeId);
  return { success: "Delegation assigned. Existing QR codes are unchanged." };
}
