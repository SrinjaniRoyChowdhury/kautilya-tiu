"use server";

import { revalidatePath } from "next/cache";
import { DOC_LABELS, bothDocsPublished, isDocKind, type DocKind } from "@/lib/docs";
import { hasPermission } from "@/lib/auth";
import { getConferenceDocLinks } from "@/lib/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export type DocsState = {
  error?: string;
  success?: string;
};

function revalidateDocs() {
  revalidatePath("/rulebook");
  revalidatePath("/admin/cms");
  revalidatePath("/dashboard/register");
}

const urlSchema = z.union([z.literal(""), z.string().trim().url()]);

export async function saveConferenceDocLinksAction(
  _prev: DocsState,
  formData: FormData,
): Promise<DocsState> {
  const allowed =
    (await hasPermission("cms.manage")) || (await hasPermission("edition.manage"));
  if (!allowed) return { error: "Only staff with CMS access can set rulebook and guidelines links." };

  const rulebookRaw = String(formData.get("rulebook_url") ?? "").trim();
  const guidelinesRaw = String(formData.get("guidelines_url") ?? "").trim();
  const rulebook = urlSchema.safeParse(rulebookRaw);
  const guidelines = urlSchema.safeParse(guidelinesRaw);
  if (!rulebook.success) return { error: "Enter a valid Rulebook URL (or leave it blank)." };
  if (!guidelines.success) return { error: "Enter a valid Guidelines URL (or leave it blank)." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to continue." };

  const admin = createAdminClient();
  const pairs: Array<{ kind: DocKind; url: string }> = [
    { kind: "rulebook", url: rulebook.data },
    { kind: "guidelines", url: guidelines.data },
  ];

  for (const { kind, url } of pairs) {
    if (!url) {
      await admin.storage.from("conference-docs").remove([`${kind}.pdf`]);
      const { error } = await admin.from("conference_documents").delete().eq("kind", kind);
      if (error) return { error: error.message };
      continue;
    }
    const { error } = await admin.from("conference_documents").upsert(
      {
        kind,
        external_url: url,
        storage_key: null,
        file_name: null,
        uploaded_by: user.id,
      },
      { onConflict: "kind" },
    );
    if (error) return { error: error.message };
  }

  await supabase.rpc("write_audit", {
    p_action: "document.links",
    p_entity: "conference_documents",
    p_entity_id: null,
    p_old: null,
    p_new: {
      rulebook_url: rulebook.data || null,
      guidelines_url: guidelines.data || null,
    },
  });
  revalidateDocs();
  return { success: "Rulebook and guidelines links saved." };
}

export async function clearConferenceDocLinkAction(
  _prev: DocsState,
  formData: FormData,
): Promise<DocsState> {
  const allowed =
    (await hasPermission("cms.manage")) || (await hasPermission("edition.manage"));
  if (!allowed) return { error: "Only staff with CMS access can clear these links." };
  const kindRaw = String(formData.get("kind") ?? "");
  if (!isDocKind(kindRaw)) return { error: "Choose rulebook or guidelines." };
  const admin = createAdminClient();
  await admin.storage.from("conference-docs").remove([`${kindRaw}.pdf`]);
  const { error } = await admin.from("conference_documents").delete().eq("kind", kindRaw);
  if (error) return { error: error.message };
  const supabase = await createClient();
  await supabase.rpc("write_audit", {
    p_action: "document.clear",
    p_entity: "conference_documents",
    p_entity_id: null,
    p_old: { kind: kindRaw },
    p_new: null,
  });
  revalidateDocs();
  return { success: `${DOC_LABELS[kindRaw]} link cleared.` };
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

  const links = await getConferenceDocLinks();
  if (!bothDocsPublished(links)) {
    return { error: "The secretariat has not published both document links yet." };
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
