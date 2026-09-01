"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { HELP_DESK_TYPES, type HelpDeskQueryType } from "@/types";
import { TEN_DIGIT_PHONE, PHONE_ERROR } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";

const querySchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80, "Name must be under 80 characters"),
  email: z.string().trim().email("Enter a valid email address"),
  phone: z.string().trim().regex(TEN_DIGIT_PHONE, PHONE_ERROR),
  type: z.enum(HELP_DESK_TYPES, {
    error: "Select a query type",
  }),
  subject: z.string().trim().min(3, "Enter a subject for your query").max(200, "Subject must be under 200 characters"),
  description: z
    .string()
    .trim()
    .min(10, "Please provide more detail in your query (at least 10 characters)")
    .max(4000, "Description must be under 4000 characters"),
});

export type ContactQueryState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
  message?: string;
};

// Aliased for any backward compatibility
export type ContactLetterState = ContactQueryState;

function firstIssue(error: z.ZodError): ContactQueryState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { error: error.issues[0]?.message ?? "Please check the form", fieldErrors };
}

function normalizePhone(raw: string): string {
  let digits = raw.trim().replace(/[\s\-()]/g, "");
  if (digits.startsWith("+91")) digits = digits.slice(3);
  else if (digits.startsWith("91") && digits.length === 12) digits = digits.slice(2);
  return digits;
}

function normalizeType(raw: string): HelpDeskQueryType {
  const lower = raw.trim().toLowerCase();
  if (lower.includes("delegate")) return "Delegate Queries";
  if (lower.includes("partner")) return "Partnership";
  if (lower.includes("press") || lower.includes("faculty")) return "Press and Faculty";
  return raw as HelpDeskQueryType;
}

export async function submitContactQuery(
  _prev: ContactQueryState,
  formData: FormData,
): Promise<ContactQueryState> {
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const type = normalizeType(String(formData.get("type") ?? ""));

  const parsed = querySchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone,
    type,
    subject: formData.get("subject"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    return firstIssue(parsed.error);
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("help_desk_queries").insert({
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      phone: parsed.data.phone,
      type: parsed.data.type,
      subject: parsed.data.subject,
      description: parsed.data.description,
      status: "PENDING",
    });

    if (error) {
      console.error("Failed to insert help desk query:", error.message);
      return { error: "Failed to submit query. Please try again later." };
    }

    revalidatePath("/admin/help-desk");

    return {
      success: true,
      message: "Your query has been submitted to the secretariat. We will get back to you shortly.",
    };
  } catch (err) {
    console.error("Exception submitting help desk query:", err);
    return { error: "An unexpected error occurred. Please try again." };
  }
}

// Backward compatibility alias for any existing reference
export const composeContactLetter = submitContactQuery;

export async function updateHelpDeskQueryStatusAction(
  id: string,
  status: "PENDING" | "RESOLVED" | "ARCHIVED",
): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("help_desk_queries")
    .update({ status })
    .eq("id", id);
  if (error) {
    return { success: false, error: error.message };
  }
  revalidatePath("/admin/help-desk");
  return { success: true };
}
