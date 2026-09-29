"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getSessionUser, hasPermission } from "@/lib/auth";
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
  FORBIDDEN: "You need payment.verify to do that.",
  ALREADY_VERIFIED: "This payment is already verified.",
  ALREADY_TERMINAL: "This payment is already closed.",
  REASON_REQUIRED: "Enter a rejection reason (at least 3 characters).",
  PROOF_REQUIRED: "Upload a payment screenshot before confirming.",
  NO_PARTICIPANTS: "This payment has no participants.",
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
  if (!isUuid(paymentId)) return { error: "Missing payment." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("verify_payment", { p_payment_id: paymentId });
  if (error) return { error: rpcMessage(error) };
  await deliverQrEmailsForPayment(paymentId);
  revalidate(paymentId);
  return { success: "Payment verified. Linked registrations are confirmed and credentials emailed." };
}

/** Admin / Delegate Affairs: attach screenshot (required) and confirm UNDER_REVIEW or PENDING. */
export async function manualConfirmPaymentAction(
  paymentId: string,
  _prev: AdminPaymentState,
  formData: FormData,
): Promise<AdminPaymentState> {
  void _prev;
  const allowed = await hasPermission("payment.verify");
  if (!allowed) return { error: "You need payment.verify to confirm payments." };
  if (!isUuid(paymentId)) return { error: "Missing payment." };

  const user = await getSessionUser();
  if (!user) return { error: "Sign in to continue." };

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
  const { error } = await supabase.rpc("staff_confirm_payment_with_proof", {
    p_payment_id: paymentId,
    p_proof_image_key: key,
    p_proof_sha256: sha,
  });
  if (error) {
    await admin.storage.from("payment-proofs").remove([key]);
    return { error: rpcMessage(error) };
  }

  await deliverQrEmailsForPayment(paymentId);
  revalidate(paymentId);
  return {
    success: "Payment confirmed with screenshot. Linked registrations are confirmed and credentials emailed.",
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
