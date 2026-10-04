"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getRoleNames, getSessionUser, hasPermission, isSuperAdmin } from "@/lib/auth";
import { compressProofImage } from "@/lib/image-compress";
import { isUuid } from "@/lib/ids";
import { deliverQrEmailsForPayment } from "@/lib/qr-mail";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { MAX_PROOF_BYTES, sniffImageMime } from "@/lib/upload";

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
  PROOF_REQUIRED: "Upload a payment screenshot before confirming.",
  NO_PARTICIPANTS: "This payment has no participants.",
  FEE_ZERO_NOT_ALLOWED:
    "Expected fee cannot be zero. Allot a payable fee first, or confirm the delegate as free.",
  FEE_INVALID: "Enter a valid amount in rupees.",
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
  if (!isUuid(paymentId)) return { error: "Missing payment." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("verify_payment", { p_payment_id: paymentId });
  if (error) return { error: rpcMessage(error) };
  await deliverQrEmailsForPayment(paymentId);
  revalidate(paymentId);
  return { success: "Payment verified. Linked registrations are confirmed and credentials emailed." };
}

/** Super Admin only: attach screenshot and confirm, optionally at a previous-phase amount. */
export async function manualConfirmPaymentAction(
  paymentId: string,
  _prev: AdminPaymentState,
  formData: FormData,
): Promise<AdminPaymentState> {
  void _prev;
  const roles = await getRoleNames();
  if (!isSuperAdmin(roles)) {
    return {
      error:
        "Only a Super Admin can manually confirm with proof at a previous-phase amount.",
    };
  }
  if (!isUuid(paymentId)) return { error: "Missing payment." };

  const user = await getSessionUser();
  if (!user) return { error: "Sign in to continue." };

  const amountRaw = String(formData.get("confirm_amount_rupees") ?? "").trim();
  let confirmAmountMinor: number | undefined;
  if (amountRaw) {
    const rupees = Number(amountRaw);
    if (!Number.isFinite(rupees) || rupees <= 0) {
      return { error: "Enter a valid previous-phase amount in rupees (greater than zero)." };
    }
    confirmAmountMinor = Math.round(rupees * 100);
  }

  const file = formData.get("proof");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Upload a JPEG, PNG, or WebP payment screenshot (max 5 MB)." };
  }
  if (file.size > MAX_PROOF_BYTES) {
    return { error: "Screenshot must be 5 MB or smaller." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!sniffImageMime(buffer)) {
    return { error: "Use JPEG, PNG, or WebP." };
  }

  const compressed = await compressProofImage(buffer);
  if ("error" in compressed) {
    return { error: compressed.error };
  }

  const sha = createHash("sha256").update(compressed.buffer).digest("hex");
  const key = `staff/${user.id}/${paymentId}/${Date.now()}.${compressed.extension}`;

  const admin = createAdminClient();
  const upload = await admin.storage.from("payment-proofs").upload(key, compressed.buffer, {
    contentType: compressed.mime,
    upsert: false,
  });
  if (upload.error) {
    return { error: "Could not store the screenshot." };
  }

  const supabase = await createClient();
  const rpcArgs: {
    p_payment_id: string;
    p_proof_image_key: string;
    p_proof_sha256: string;
    p_confirm_amount_minor?: number;
  } = {
    p_payment_id: paymentId,
    p_proof_image_key: key,
    p_proof_sha256: sha,
  };
  if (confirmAmountMinor != null) rpcArgs.p_confirm_amount_minor = confirmAmountMinor;

  const { error } = await supabase.rpc("staff_confirm_payment_with_proof", rpcArgs);
  if (error) {
    await admin.storage.from("payment-proofs").remove([key]);
    return { error: rpcMessage(error) };
  }

  await deliverQrEmailsForPayment(paymentId);
  revalidate(paymentId);
  return {
    success: confirmAmountMinor != null
      ? "Payment confirmed at the entered previous-phase amount. Credentials emailed."
      : "Payment confirmed with screenshot. Linked registrations are confirmed and credentials emailed.",
  };
}

export async function rejectPaymentAction(
  paymentId: string,
  _prev: AdminPaymentState,
  formData: FormData,
): Promise<AdminPaymentState> {
  const allowed = await hasPermission("payment.verify");
  if (!allowed) return { error: "You need payment.verify to reject payments." };
  if (!isUuid(paymentId)) return { error: "Missing payment." };
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
