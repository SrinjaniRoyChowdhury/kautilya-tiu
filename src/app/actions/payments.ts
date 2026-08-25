"use server";

import { headers } from "next/headers";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { istDateTimeToIso, rupeesToMinor } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import { parseEmailList } from "@/lib/payments";
import { PAYMENT_LIMIT, PAYMENT_WINDOW_MS, clientKeyFromHeaders, rateLimit } from "@/lib/rate-limit";
import { MAX_PROOF_BYTES, proofExtension, sniffImageMime } from "@/lib/upload";
import { createClient } from "@/lib/supabase/server";

export type PaymentState = {
  error?: string;
  success?: string;
  warning?: string;
};

const RPC_MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "Sign in to continue.",
  EMAIL_UNVERIFIED: "Verify your email before paying. Locally the link lands in Inbucket on port 54324.",
  NOT_FOUND: "Payment not found.",
  FORBIDDEN: "You do not have permission to do that.",
  EMAIL_REQUIRED: "Enter a valid email.",
  EMAIL_ALREADY_ON_ACTIVE_PAYMENT:
    "That email is already on another active payment. Wait until it is verified, rejected, or cancelled.",
  DUPLICATE_EMAIL_IN_LIST: "The same email appears twice in this payment.",
  PAYMENT_ALREADY_VERIFIED: "That participant is already confirmed.",
  PAYMENT_LOCKED: "This payment can no longer be edited.",
  REGISTRATION_INCOMPLETE:
    "Submit your own registration before paying for yourself, or uncheck “Pay for myself” and select registered delegates instead.",
  NOT_REGISTERED:
    "That person has not submitted a registration, so the fee is unknown and they cannot be added.",
  NO_PARTICIPANTS: "Add at least one participant.",
  PROOF_REQUIRED: "Upload a payment screenshot.",
  AMOUNT_REQUIRED: "Enter the amount you transferred.",
  ALREADY_VERIFIED: "This payment is already verified.",
  ALREADY_TERMINAL: "This payment can no longer be changed.",
  ALREADY_SUBMITTED: "Proof is already under review.",
  REASON_REQUIRED: "A rejection reason is required.",
};

function rpcMessage(error: { message?: string } | null): string {
  const raw = (error?.message ?? "").toUpperCase();
  for (const [code, text] of Object.entries(RPC_MESSAGES)) {
    if (raw.includes(code)) return text;
  }
  return error?.message || "Something went wrong. Try again.";
}

function paymentIdFrom(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const payment = (data as { payment?: { id?: string } }).payment;
  return payment?.id ?? null;
}

function revalidatePayment(paymentId?: string | null) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/pay");
  revalidatePath("/dashboard/register");
  revalidatePath("/admin");
  revalidatePath("/admin/payments");
  if (paymentId) {
    revalidatePath(`/dashboard/pay/${paymentId}`);
    revalidatePath(`/admin/payments/${paymentId}`);
  }
}

export async function startPaymentAction(
  editionId: string,
  _prev: PaymentState,
  formData: FormData,
): Promise<PaymentState> {
  if (!isUuid(editionId)) {
    return { error: "Missing edition." };
  }
  const includeSelf = formData.get("include_self") === "on";
  const emails = parseEmailList(String(formData.get("emails") ?? ""));
  if (!includeSelf && emails.length === 0) {
    return { error: "Pay for yourself or select at least one registered delegate." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_or_get_payment", {
    p_edition_id: editionId,
    p_emails: emails,
    p_include_self: includeSelf,
  });
  if (error) return { error: rpcMessage(error) };
  const id = paymentIdFrom(data);
  if (!id) return { error: "Could not start payment." };
  revalidatePayment(id);
  redirect(`/dashboard/pay/${id}`);
}

export async function addPaymentEmailsAction(
  paymentId: string,
  _prev: PaymentState,
  formData: FormData,
): Promise<PaymentState> {
  const emails = parseEmailList(String(formData.get("emails") ?? ""));
  if (!emails.length) return { error: "Select at least one registered delegate." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_payment_emails", {
    p_payment_id: paymentId,
    p_emails: emails,
  });
  if (error) return { error: rpcMessage(error) };
  revalidatePayment(paymentId);
  return { success: "Participants updated." };
}

export async function correctUnmatchedEmailAction(
  paymentId: string,
  _prev: PaymentState,
  formData: FormData,
): Promise<PaymentState> {
  const participantId = String(formData.get("participant_id") ?? "");
  const email = String(formData.get("email") ?? "");
  if (!isUuid(participantId)) {
    return { error: "Missing participant." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("correct_unmatched_email", {
    p_participant_id: participantId,
    p_email: email,
  });
  if (error) return { error: rpcMessage(error) };
  revalidatePayment(paymentId);
  return { success: "Email updated." };
}

export async function submitPaymentProofAction(
  paymentId: string,
  _prev: PaymentState,
  formData: FormData,
): Promise<PaymentState> {
  const rupees = Number(formData.get("paid_rupees"));
  if (!Number.isFinite(rupees) || rupees <= 0) {
    return { error: "Enter the amount you transferred, in rupees." };
  }
  const file = formData.get("proof");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Upload a JPEG, PNG, or WebP screenshot (max 5 MB)." };
  }
  if (file.size > MAX_PROOF_BYTES) {
    return { error: "Screenshot must be 5 MB or smaller." };
  }

  const ip = clientKeyFromHeaders(await headers());
  if (!rateLimit(`pay:${ip}`, PAYMENT_LIMIT, PAYMENT_WINDOW_MS)) {
    return { error: "Too many uploads. Try again in a few minutes." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = sniffImageMime(buffer);
  if (!mime) {
    return { error: "Use JPEG, PNG, or WebP." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to continue." };

  const sha = createHash("sha256").update(buffer).digest("hex");
  const ext = proofExtension(mime);
  const key = `${user.id}/${paymentId}/${Date.now()}.${ext}`;

  const upload = await supabase.storage.from("payment-proofs").upload(key, buffer, {
    contentType: mime,
    upsert: false,
  });
  if (upload.error) {
    return { error: "Could not store the screenshot." };
  }

  const paidAtRaw = String(formData.get("paid_at") ?? "").trim();
  const paidAt = paidAtRaw ? istDateTimeToIso(paidAtRaw) : null;
  const txn = String(formData.get("transaction_ref") ?? "").trim();

  const { data, error } = await supabase.rpc("submit_payment_proof", {
    p_payment_id: paymentId,
    p_proof_image_key: key,
    p_paid_amount_minor: rupeesToMinor(rupees),
    p_transaction_ref: txn || null,
    p_paid_at: paidAt,
    p_proof_sha256: sha,
  });
  if (error) return { error: rpcMessage(error) };

  revalidatePayment(paymentId);
  const dup = (data as { duplicate_payment_ids?: string[] } | null)?.duplicate_payment_ids ?? [];
  return {
    success: "Screenshot submitted. The secretariat will review it.",
    warning:
      Array.isArray(dup) && dup.length
        ? "This screenshot matches another payment on file. Staff will see a duplicate warning."
        : undefined,
  };
}

export async function updatePaymentInstructionsAction(
  editionId: string,
  _prev: PaymentState,
  formData: FormData,
): Promise<PaymentState> {
  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc("has_permission", {
    p_code: "edition.manage",
    p_edition_id: editionId,
  });
  if (!allowed) return { error: "You do not have permission to edit payment instructions." };

  const payload = {
    edition_id: editionId,
    upi_id: String(formData.get("upi_id") ?? "").trim() || null,
    bank_name: String(formData.get("bank_name") ?? "").trim() || null,
    account_name: String(formData.get("account_name") ?? "").trim() || null,
    account_number: String(formData.get("account_number") ?? "").trim() || null,
    ifsc: String(formData.get("ifsc") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  };

  const { error } = await supabase.from("payment_instructions").upsert(payload, {
    onConflict: "edition_id",
  });
  if (error) return { error: error.message };
  revalidatePath(`/admin/editions/${editionId}`);
  revalidatePath("/dashboard/pay");
  return { success: "Payment instructions saved." };
}
