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
  FORBIDDEN: "You need payment.verify to do that.",
  ALREADY_VERIFIED: "This payment is already verified.",
  ALREADY_TERMINAL: "This payment is already closed.",
  REASON_REQUIRED: "Enter a rejection reason (at least 3 characters).",
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
