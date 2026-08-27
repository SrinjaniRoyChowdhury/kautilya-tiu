"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasPermission, isStaffUser } from "@/lib/auth";
import { isUuid } from "@/lib/ids";
import { createClient } from "@/lib/supabase/server";

export type InstitutionState = {
  error?: string;
  success?: string;
};

const nameSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
});

function revalidate() {
  revalidatePath("/admin/collectives");
  revalidatePath("/dashboard/register");
}

export async function createInstitutionAction(
  _prev: InstitutionState,
  formData: FormData,
): Promise<InstitutionState> {
  if (!(await isStaffUser())) return { error: "Staff only." };
  if (!(await hasPermission("edition.manage"))) return { error: "You cannot edit institutions." };
  const parsed = nameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter a name." };
  const supabase = await createClient();
  const { error } = await supabase.from("institutions").insert({ name: parsed.data.name });
  if (error) {
    if (error.message.toLowerCase().includes("unique") || error.code === "23505") {
      return { error: "An institution with that name already exists." };
    }
    return { error: error.message };
  }
  await supabase.rpc("write_audit", {
    p_action: "institution.create",
    p_entity: "institutions",
    p_entity_id: null,
    p_old: null,
    p_new: { name: parsed.data.name },
  });
  revalidate();
  return { success: `${parsed.data.name} added.` };
}

export async function updateInstitutionAction(
  id: string,
  _prev: InstitutionState,
  formData: FormData,
): Promise<InstitutionState> {
  if (!(await isStaffUser())) return { error: "Staff only." };
  if (!(await hasPermission("edition.manage"))) return { error: "You cannot edit institutions." };
  if (!isUuid(id)) return { error: "Missing institution." };
  const parsed = nameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter a name." };
  const supabase = await createClient();
  const { error } = await supabase.from("institutions").update({ name: parsed.data.name }).eq("id", id);
  if (error) {
    if (error.message.toLowerCase().includes("unique") || error.code === "23505") {
      return { error: "An institution with that name already exists." };
    }
    return { error: error.message };
  }
  await supabase.rpc("write_audit", {
    p_action: "institution.update",
    p_entity: "institutions",
    p_entity_id: id,
    p_old: null,
    p_new: { name: parsed.data.name },
  });
  revalidate();
  return { success: "Institution updated." };
}

export async function deleteInstitutionAction(
  id: string,
  _prev: InstitutionState,
  _formData: FormData,
): Promise<InstitutionState> {
  void _prev;
  void _formData;
  if (!(await isStaffUser())) return { error: "Staff only." };
  if (!(await hasPermission("edition.manage"))) return { error: "You cannot edit institutions." };
  if (!isUuid(id)) return { error: "Missing institution." };
  const supabase = await createClient();
  const { error } = await supabase.from("institutions").delete().eq("id", id);
  if (error) return { error: error.message };
  await supabase.rpc("write_audit", {
    p_action: "institution.delete",
    p_entity: "institutions",
    p_entity_id: id,
    p_old: null,
    p_new: null,
  });
  revalidate();
  return { success: "Institution removed. Existing registrations keep the name they entered." };
}
