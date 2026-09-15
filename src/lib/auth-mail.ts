import type { EmailOtpType } from "@supabase/supabase-js";
import { APP_NAME } from "@/lib/constants";
import { deliverEmail, type MailResult } from "@/lib/mail";
import { createAdminClient } from "@/lib/supabase/admin";

/** True when the app can send mail itself (Brevo in prod, Mailpit locally). */
export function appMailConfigured(): boolean {
  return Boolean(process.env.BREVO_API_KEY?.trim() || process.env.MAILPIT_URL?.trim());
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function confirmUrl(
  origin: string,
  hashedToken: string,
  type: EmailOtpType,
  next: string,
): string {
  const url = new URL(`${origin.replace(/\/+$/, "")}/auth/confirm`);
  url.searchParams.set("token_hash", hashedToken);
  url.searchParams.set("type", type);
  url.searchParams.set("next", next);
  return url.toString();
}

type LinkMailOpts = {
  to: string;
  toName?: string;
  origin: string;
  next: string;
  subject: string;
  introHtml: string;
  ctaLabel: string;
};

async function sendLinkEmail(
  opts: LinkMailOpts & { hashedToken: string; type: EmailOtpType },
): Promise<MailResult> {
  const link = confirmUrl(opts.origin, opts.hashedToken, opts.type, opts.next);
  const name = opts.toName?.trim() || "there";
  return deliverEmail({
    to: opts.to,
    toName: opts.toName,
    subject: opts.subject,
    html: [
      `<p>Dear ${escapeHtml(name)},</p>`,
      opts.introHtml,
      `<p><a href="${link}">${escapeHtml(opts.ctaLabel)}</a></p>`,
      `<p>If the button does not work, copy this link into your browser:</p>`,
      `<p style="word-break:break-all">${escapeHtml(link)}</p>`,
      `<p>If you did not request this, you can ignore this email.</p>`,
    ].join(""),
  });
}

/**
 * Create the Auth user (if needed) and email a signup confirmation link via Brevo/Mailpit.
 * Does not rely on Supabase's built-in SMTP (which is not production-ready).
 */
export async function sendSignupConfirmationEmail(input: {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  origin: string;
}): Promise<{ ok: true } | { ok: false; error: string; alreadyRegistered?: boolean }> {
  const admin = createAdminClient();
  const redirectTo = `${input.origin.replace(/\/+$/, "")}/auth/confirm?next=/dashboard`;

  const { data, error } = await admin.auth.admin.generateLink({
    type: "signup",
    email: input.email,
    password: input.password,
    options: {
      data: {
        full_name: input.fullName,
        phone: input.phone,
      },
      redirectTo,
    },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
      return { ok: false, error: "That email is already registered. Sign in instead.", alreadyRegistered: true };
    }
    return { ok: false, error: error.message || "Could not create the account." };
  }

  const hashedToken = data.properties?.hashed_token;
  const userId = data.user?.id;
  if (!hashedToken) {
    if (userId) {
      await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    }
    return { ok: false, error: "Could not create a verification link." };
  }

  const mail = await sendLinkEmail({
    to: input.email,
    toName: input.fullName,
    origin: input.origin,
    next: "/dashboard",
    hashedToken,
    type: "signup",
    subject: `Verify your ${APP_NAME} email`,
    introHtml: `<p>Thanks for signing up for ${escapeHtml(APP_NAME)}. Confirm your email to register and pay.</p>`,
    ctaLabel: "Verify email",
  });

  if (!mail.delivered) {
    if (userId) {
      await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    }
    return {
      ok: false,
      error: mail.error ?? "Could not send the verification email. Try again shortly.",
    };
  }
  return { ok: true };
}

/** Resend verification for an existing (usually unconfirmed) account. */
export async function sendResendVerificationEmail(input: {
  email: string;
  fullName?: string | null;
  origin: string;
}): Promise<MailResult> {
  const admin = createAdminClient();
  const redirectTo = `${input.origin.replace(/\/+$/, "")}/auth/confirm?next=/dashboard`;

  // magiclink works for existing users; clicking it confirms email and signs them in.
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: input.email,
    options: { redirectTo },
  });
  if (error) {
    return { delivered: false, error: error.message };
  }
  const hashedToken = data.properties?.hashed_token;
  if (!hashedToken) {
    return { delivered: false, error: "Could not create a verification link." };
  }

  return sendLinkEmail({
    to: input.email,
    toName: input.fullName ?? undefined,
    origin: input.origin,
    next: "/dashboard",
    hashedToken,
    type: "magiclink",
    subject: `Verify your ${APP_NAME} email`,
    introHtml: `<p>Use the link below to verify your email for ${escapeHtml(APP_NAME)}.</p>`,
    ctaLabel: "Verify email",
  });
}

export async function sendPasswordResetEmail(input: {
  email: string;
  origin: string;
}): Promise<MailResult> {
  const admin = createAdminClient();
  const redirectTo = `${input.origin.replace(/\/+$/, "")}/auth/confirm?next=/dashboard/profile`;

  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: input.email,
    options: { redirectTo },
  });
  if (error) {
    // Do not leak whether the account exists.
    return { delivered: true };
  }
  const hashedToken = data.properties?.hashed_token;
  if (!hashedToken) {
    return { delivered: true };
  }

  return sendLinkEmail({
    to: input.email,
    origin: input.origin,
    next: "/dashboard/profile",
    hashedToken,
    type: "recovery",
    subject: `Reset your ${APP_NAME} password`,
    introHtml: `<p>We received a request to reset your ${escapeHtml(APP_NAME)} password.</p>`,
    ctaLabel: "Reset password",
  });
}
