"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isStaffUser } from "@/lib/auth";
import { isUuid } from "@/lib/ids";
import { createClient } from "@/lib/supabase/server";

export type CollectiveState = {
  error?: string;
  success?: string;
};

const nameSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
});

function revalidate() {
  revalidatePath("/admin/collectives");
  revalidatePath("/dashboard/register");
}

export async function createCollectiveAction(
  _prev: CollectiveState,
  formData: FormData,
): Promise<CollectiveState> {
  if (!(await isStaffUser())) return { error: "Staff only." };
  const parsed = nameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter a name." };
  const supabase = await createClient();
  const { error } = await supabase.from("collectives").insert({ name: parsed.data.name });
  if (error) {
    if (error.message.toLowerCase().includes("unique") || error.code === "23505") {
      return { error: "A collective with that name already exists." };
    }
    return { error: error.message };
  }
  await supabase.rpc("write_audit", {
    p_action: "collective.create",
    p_entity: "collectives",
    p_entity_id: null,
    p_old: null,
    p_new: { name: parsed.data.name },
  });
  revalidate();
  return { success: `${parsed.data.name} added.` };
}

export async function updateCollectiveAction(
  id: string,
  _prev: CollectiveState,
  formData: FormData,
): Promise<CollectiveState> {
  if (!(await isStaffUser())) return { error: "Staff only." };
  if (!isUuid(id)) return { error: "Missing collective." };
  const parsed = nameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter a name." };
  const supabase = await createClient();
  const { error } = await supabase.from("collectives").update({ name: parsed.data.name }).eq("id", id);
  if (error) {
    if (error.message.toLowerCase().includes("unique") || error.code === "23505") {
      return { error: "A collective with that name already exists." };
    }
    return { error: error.message };
  }
  await supabase.rpc("write_audit", {
    p_action: "collective.update",
    p_entity: "collectives",
    p_entity_id: id,
    p_old: null,
    p_new: { name: parsed.data.name },
  });
  revalidate();
  return { success: "Collective updated." };
}

export async function deleteCollectiveAction(
  id: string,
  _prev: CollectiveState,
  _formData: FormData,
): Promise<CollectiveState> {
  void _prev;
  void _formData;
  if (!(await isStaffUser())) return { error: "Staff only." };
  if (!isUuid(id)) return { error: "Missing collective." };
  const supabase = await createClient();
  const { error } = await supabase.from("collectives").delete().eq("id", id);
  if (error) return { error: error.message };
  await supabase.rpc("write_audit", {
    p_action: "collective.delete",
    p_entity: "collectives",
    p_entity_id: id,
    p_old: null,
    p_new: null,
  });
  revalidate();
  return { success: "Collective removed. Linked registrations keep their other details." };
}
