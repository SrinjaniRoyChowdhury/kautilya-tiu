"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  AUTH_LIMIT,
  AUTH_WINDOW_MS,
  SIGNUP_LIMIT,
  clientKeyFromHeaders,
  rateLimit,
} from "@/lib/rate-limit";
import { hasScanAccess, getRoleNames, isContentEditorOnly, isOperatorOnly, isProtectedAdminEmail } from "@/lib/auth";
import { safeInternalPath } from "@/lib/safe-path";
import { createClient } from "@/lib/supabase/server";

const signupSchema = z.object({
  full_name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  email: z.string().trim().email("Enter a valid email"),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[a-z]/, "Include a lowercase letter")
    .regex(/[A-Z]/, "Include an uppercase letter")
    .regex(/[0-9]/, "Include a number"),
});

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export type AuthState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: string;
};

function firstIssue(error: z.ZodError): AuthState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { error: error.issues[0]?.message ?? "Please check the form", fieldErrors };
}

async function authClientKey(): Promise<string> {
  return clientKeyFromHeaders(await headers());
}

export async function signupAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const ip = await authClientKey();
  if (!rateLimit(`signup:${ip}`, SIGNUP_LIMIT, AUTH_WINDOW_MS)) {
    return { error: "Too many sign-up attempts. Try again in 15 minutes." };
  }
  const parsed = signupSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
  });
  if (!parsed.success) return firstIssue(parsed.error);

  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.full_name,
        phone: parsed.data.phone || undefined,
      },
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already")) {
      return { error: "That email is already registered. Sign in instead." };
    }
    return { error: "Could not create the account. Try again." };
  }

  return {
    success:
      "Check your inbox for a verification link. Until you verify, you can browse but cannot register or pay.",
  };
}

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return firstIssue(parsed.error);

  const ip = await authClientKey();
  const emailKey = parsed.data.email.toLowerCase();
  if (
    !rateLimit(`login-ip:${ip}`, AUTH_LIMIT, AUTH_WINDOW_MS) ||
    !rateLimit(`login:${ip}:${emailKey}`, AUTH_LIMIT, AUTH_WINDOW_MS)
  ) {
    return { error: "Too many sign-in attempts. Try again in 15 minutes." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { error: "Invalid email or password." };
  }

  const requested = safeInternalPath(formData.get("next"), "/dashboard");
  redirect(await postLoginPath(requested));
}

async function postLoginPath(requested: string): Promise<string> {
  const [canScan, roles] = await Promise.all([hasScanAccess(), getRoleNames()]);
  if (requested.startsWith("/scan") && !canScan) return "/dashboard";
  if (isOperatorOnly(roles)) return "/scan";
  if (isContentEditorOnly(roles)) return "/admin/cms";
  return requested;
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function forgotPasswordAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const parsed = z.string().email().safeParse(email);
  if (!parsed.success) return { error: "Enter a valid email", fieldErrors: { email: "Enter a valid email" } };

  const ip = await authClientKey();
  if (!rateLimit(`reset:${ip}`, SIGNUP_LIMIT, AUTH_WINDOW_MS)) {
    return { error: "Too many reset attempts. Try again in 15 minutes." };
  }

  if (isProtectedAdminEmail(parsed.data)) {
    return {
      success: "If that email exists, a reset link is on its way. Check Inbucket locally (port 54324).",
    };
  }

  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${origin}/auth/confirm?next=/dashboard/profile`,
  });
  return {
    success: "If that email exists, a reset link is on its way. Check Inbucket locally (port 54324).",
  };
}
