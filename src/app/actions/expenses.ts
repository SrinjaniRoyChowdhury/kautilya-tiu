"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasPermission } from "@/lib/auth";
import { isUuid } from "@/lib/ids";
import { rupeesFromForm } from "@/lib/phases";
import { createClient } from "@/lib/supabase/server";

export type ExpenseState = {
  error?: string;
  success?: string;
};

const schema = z.object({
  edition_id: z.string().trim().refine(isUuid, { error: "Choose an edition." }),
  title: z.string().trim().min(2).max(120),
  category: z.string().trim().max(40).optional().or(z.literal("")),
  amount_rupees: z.coerce.number().min(0).max(10_000_000),
  incurred_on: z.string().trim().min(8),
  notes: z.string().trim().max(400).optional().or(z.literal("")),
});

function revalidate(editionId: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/expenses");
  revalidatePath(`/admin/editions/${editionId}`);
}

export async function createExpenseAction(
  _prev: ExpenseState,
  formData: FormData,
): Promise<ExpenseState> {
  if (!(await hasPermission("edition.manage"))) return { error: "Only an admin can add expenses." };
  const parsed = schema.safeParse({
    edition_id: String(formData.get("edition_id") ?? ""),
    title: formData.get("title"),
    category: formData.get("category"),
    amount_rupees: formData.get("amount_rupees"),
    incurred_on: formData.get("incurred_on"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the expense form." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("edition_expenses").insert({
    edition_id: parsed.data.edition_id,
    title: parsed.data.title,
    category: parsed.data.category || null,
    amount_minor: rupeesFromForm(parsed.data.amount_rupees),
    incurred_on: parsed.data.incurred_on,
    notes: parsed.data.notes || null,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };
  await supabase.rpc("write_audit", {
    p_action: "expense.create",
    p_entity: "edition_expenses",
    p_entity_id: null,
    p_old: null,
    p_new: { title: parsed.data.title, amount_rupees: parsed.data.amount_rupees },
  });
  revalidate(parsed.data.edition_id);
  return { success: "Expense added." };
}

export async function updateExpenseAction(
  id: string,
  _prev: ExpenseState,
  formData: FormData,
): Promise<ExpenseState> {
  if (!(await hasPermission("edition.manage"))) return { error: "Only an admin can edit expenses." };
  if (!isUuid(id)) return { error: "Missing expense." };
  const parsed = schema.safeParse({
    edition_id: String(formData.get("edition_id") ?? ""),
    title: formData.get("title"),
    category: formData.get("category"),
    amount_rupees: formData.get("amount_rupees"),
    incurred_on: formData.get("incurred_on"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the expense form." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("edition_expenses")
    .update({
      title: parsed.data.title,
      category: parsed.data.category || null,
      amount_minor: rupeesFromForm(parsed.data.amount_rupees),
      incurred_on: parsed.data.incurred_on,
      notes: parsed.data.notes || null,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidate(parsed.data.edition_id);
  return { success: "Expense updated." };
}

export async function deleteExpenseAction(id: string, editionId: string): Promise<ExpenseState> {
  if (!(await hasPermission("edition.manage"))) return { error: "Only an admin can delete expenses." };
  if (!isUuid(id)) return { error: "Missing expense." };
  const supabase = await createClient();
  const { error } = await supabase.from("edition_expenses").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidate(editionId);
  return { success: "Expense removed." };
}
