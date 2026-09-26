"use server";

import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/auth";
import { deliverQrEmailsForPayment } from "@/lib/qr-mail";
import { createClient } from "@/lib/supabase/server";

export type AdminPaymentState = {
  error?: string;
  success?: string;
};

const RPC_MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "Sign in to continue.",
  NOT_FOUND: "Payment not found.",
  FORBIDDEN: "You need payment.verify or payment.edit to do that.",
  ALREADY_VERIFIED: "This payment is already verified.",
  ALREADY_TERMINAL: "This payment is already closed.",
  REASON_REQUIRED: "Enter a rejection reason (at least 3 characters).",
  PAYMENT_LOCKED: "This payment can no longer be edited.",
  EMAIL_REQUIRED: "Enter a delegate email.",
  DUPLICATE_EMAIL_IN_LIST: "That person is already on this payment.",
  NOT_REGISTERED: "That email has no allocated registration for this edition.",
  ALLOCATION_PENDING: "That delegate has not been allocated a committee yet.",
  PAYMENT_ALREADY_VERIFIED: "That delegate is already confirmed or payment-verified.",
};

function rpcMessage(error: { message?: string } | null): string {
  const raw = (error?.message ?? "").toUpperCase();
  for (const [code, text] of Object.entries(RPC_MESSAGES)) {
    if (raw.includes(code)) return text;
  }
  return error?.message || "Something went wrong. Try again.";
}

function revalidate(paymentId: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/payments");
  revalidatePath(`/admin/payments/${paymentId}`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/pay");
  revalidatePath(`/dashboard/pay/${paymentId}`);
  revalidatePath("/dashboard/register");
  revalidatePath("/dashboard/qr");
  revalidatePath("/admin/credentials");
  revalidatePath("/admin/participants");
}

async function canEditPaymentParticipants(): Promise<boolean> {
  return (await hasPermission("payment.edit")) || (await hasPermission("payment.verify"));
}

export async function verifyPaymentAction(
  paymentId: string,
  _prev: AdminPaymentState,
  _formData: FormData,
): Promise<AdminPaymentState> {
  void _formData;
  const allowed = await hasPermission("payment.verify");
  if (!allowed) return { error: "You need payment.verify to confirm payments." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("verify_payment", { p_payment_id: paymentId });
  if (error) return { error: rpcMessage(error) };
  await deliverQrEmailsForPayment(paymentId);
  revalidate(paymentId);
  return { success: "Payment verified. Linked registrations are confirmed and credentials emailed." };
}

export async function rejectPaymentAction(
  paymentId: string,
  _prev: AdminPaymentState,
  formData: FormData,
): Promise<AdminPaymentState> {
  const allowed = await hasPermission("payment.verify");
  if (!allowed) return { error: "You need payment.verify to reject payments." };
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 3) return { error: "Enter a rejection reason (at least 3 characters)." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_payment", {
    p_payment_id: paymentId,
    p_reason: reason,
  });
  if (error) return { error: rpcMessage(error) };
  revalidate(paymentId);
  return { success: "Payment rejected. The payer can resubmit proof." };
}

export async function attachPaymentParticipantAction(
  paymentId: string,
  _prev: AdminPaymentState,
  formData: FormData,
): Promise<AdminPaymentState> {
  if (!(await canEditPaymentParticipants())) {
    return { error: "You need payment.edit to attach delegates." };
  }
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email.includes("@")) return { error: "Enter a registered delegate email." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_attach_payment_participant", {
    p_payment_id: paymentId,
    p_email: email,
  });
  if (error) return { error: rpcMessage(error) };
  revalidate(paymentId);
  return { success: `${email} attached. Expected amount recalculated.` };
}

export async function detachPaymentParticipantAction(
  paymentId: string,
  participantId: string,
  _prev: AdminPaymentState,
  _formData: FormData,
): Promise<AdminPaymentState> {
  void _formData;
  if (!(await canEditPaymentParticipants())) {
    return { error: "You need payment.edit to detach delegates." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_detach_payment_participant", {
    p_participant_id: participantId,
  });
  if (error) return { error: rpcMessage(error) };
  revalidate(paymentId);
  return { success: "Delegate removed from this payment. Expected amount recalculated." };
}
