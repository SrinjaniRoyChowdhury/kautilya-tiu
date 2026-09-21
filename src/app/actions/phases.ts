"use server";

import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/auth";
import { isUuid } from "@/lib/ids";
import { createClient } from "@/lib/supabase/server";

export type PhaseState = {
  error?: string;
  success?: string;
};

export async function activatePhaseAction(phaseId: string): Promise<PhaseState> {
  if (!(await hasPermission("edition.manage"))) return { error: "Only an admin can change the active phase." };
  if (!isUuid(phaseId)) return { error: "Missing phase." };
  const supabase = await createClient();

  const { data: phase } = await supabase
    .from("registration_phases")
    .select("id, edition_id, kind, is_active")
    .eq("id", phaseId)
    .maybeSingle();

  const { data: previous } = phase?.edition_id
    ? await supabase
        .from("registration_phases")
        .select("id, kind")
        .eq("edition_id", phase.edition_id)
        .eq("is_active", true)
        .maybeSingle()
    : { data: null };

  const { error } = await supabase.rpc("activate_registration_phase", { p_phase_id: phaseId });
  if (error) {
    const raw = (error.message ?? "").toUpperCase();
    if (raw.includes("FORBIDDEN")) return { error: "Only an admin can change the active phase." };
    return { error: error.message };
  }

  await supabase.rpc("write_audit", {
    p_action: "phase.activate",
    p_entity: "registration_phases",
    p_entity_id: phaseId,
    p_old: previous,
    p_new: {
      kind: phase?.kind ?? null,
      edition_id: phase?.edition_id ?? null,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/editions");
  revalidatePath("/admin/committees");
  revalidatePath("/committees");
  revalidatePath("/dashboard/register");
  return { success: "Active registration phase updated. New submissions use this phase's fees." };
}
