"use server";

import { revalidatePath } from "next/cache";
import { DOC_KINDS, DOC_LABELS, MAX_DOC_BYTES, isDocKind, type DocKind } from "@/lib/docs";
import { hasPermission } from "@/lib/auth";
import { sniffPdf } from "@/lib/upload";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type DocsState = {
  error?: string;
  success?: string;
};

function revalidateDocs() {
  revalidatePath("/rulebook");
  revalidatePath("/admin/cms");
  revalidatePath("/dashboard/register");
}

export async function uploadConferenceDocAction(
  _prev: DocsState,
  formData: FormData,
): Promise<DocsState> {
  const allowed = await hasPermission("edition.manage");
  if (!allowed) return { error: "Only an admin can upload the rulebook or guidelines." };
  const kindRaw = String(formData.get("kind") ?? "");
  if (!isDocKind(kindRaw)) return { error: "Choose rulebook or guidelines." };
  const kind: DocKind = kindRaw;
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Upload a PDF." };
  if (file.size > MAX_DOC_BYTES) return { error: "PDF must be 12 MB or smaller." };
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!sniffPdf(buffer)) return { error: "That file is not a PDF." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to continue." };

  const key = `${kind}.pdf`;
  const admin = createAdminClient();
  const upload = await admin.storage.from("conference-docs").upload(key, buffer, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (upload.error) return { error: "Could not store the PDF." };

  const { error } = await admin.from("conference_documents").upsert(
    {
      kind,
      file_name: file.name.replace(/[^\w.\- ()]/g, "") || `${kind}.pdf`,
      storage_key: key,
      uploaded_by: user.id,
    },
    { onConflict: "kind" },
  );
  if (error) return { error: error.message };
  await supabase.rpc("write_audit", {
    p_action: "document.upload",
    p_entity: "conference_documents",
    p_entity_id: null,
    p_old: null,
    p_new: { kind, file_name: file.name },
  });
  revalidateDocs();
  return { success: `${DOC_LABELS[kind]} published.` };
}

export async function deleteConferenceDocAction(
  _prev: DocsState,
  formData: FormData,
): Promise<DocsState> {
  const allowed = await hasPermission("edition.manage");
  if (!allowed) return { error: "Only an admin can delete the rulebook or guidelines." };
  const kindRaw = String(formData.get("kind") ?? "");
  if (!isDocKind(kindRaw)) return { error: "Choose rulebook or guidelines." };
  const admin = createAdminClient();
  await admin.storage.from("conference-docs").remove([`${kindRaw}.pdf`]);
  const { error } = await admin.from("conference_documents").delete().eq("kind", kindRaw);
  if (error) return { error: error.message };
  const supabase = await createClient();
  await supabase.rpc("write_audit", {
    p_action: "document.delete",
    p_entity: "conference_documents",
    p_entity_id: null,
    p_old: { kind: kindRaw },
    p_new: null,
  });
  revalidateDocs();
  return { success: `${DOC_LABELS[kindRaw]} removed.` };
}

export async function acceptConferenceRulesAction(
  _prev: DocsState,
  formData: FormData,
): Promise<DocsState> {
  const registrationId = String(formData.get("registration_id") ?? "");
  const rulebook = String(formData.get("read_rulebook") ?? "") === "on";
  const guidelines = String(formData.get("read_guidelines") ?? "") === "on";
  if (!rulebook || !guidelines) {
    return { error: "Confirm that you have read both the rulebook and the guidelines." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to continue." };

  const { data: docs } = await supabase.from("conference_documents").select("kind");
  const kinds = new Set(((docs as Array<{ kind: string }> | null) ?? []).map((row) => row.kind));
  if (!DOC_KINDS.every((kind) => kinds.has(kind))) {
    return { error: "The secretariat has not published both PDFs yet." };
  }

  const { data: registration } = await supabase
    .from("registrations")
    .select("id, user_id")
    .eq("id", registrationId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!registration) return { error: "Start registration first." };

  const { error } = await supabase
    .from("registrations")
    .update({ accepted_rules_at: new Date().toISOString() })
    .eq("id", registrationId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  await supabase.rpc("write_audit", {
    p_action: "registration.accept_rules",
    p_entity: "registrations",
    p_entity_id: registrationId,
    p_old: null,
    p_new: { accepted: true },
  });
  revalidatePath("/dashboard/register");
  return { success: "Acknowledged. You can fill the registration form." };
}
