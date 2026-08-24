"use server";

import { z } from "zod";
import { letterMailto } from "@/lib/contact";

const letterSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: z.string().trim().email("Enter a valid email"),
  desk: z.enum(["delegate", "partner", "press", "other"]),
  message: z
    .string()
    .trim()
    .min(12, "Write at least a short note")
    .max(2000, "Keep the letter under 2000 characters"),
});

export type ContactLetterState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  mailto?: string;
};

function firstIssue(error: z.ZodError): ContactLetterState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { error: error.issues[0]?.message ?? "Please check the letter", fieldErrors };
}

export async function composeContactLetter(
  _prev: ContactLetterState,
  formData: FormData,
): Promise<ContactLetterState> {
  const parsed = letterSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    desk: formData.get("desk"),
    message: formData.get("message"),
  });
  if (!parsed.success) return firstIssue(parsed.error);

  const to = String(formData.get("to") ?? "").trim();
  if (!to.includes("@")) {
    return { error: "The secretariat email is not configured yet." };
  }

  return {
    mailto: letterMailto({ to, ...parsed.data }),
  };
}
