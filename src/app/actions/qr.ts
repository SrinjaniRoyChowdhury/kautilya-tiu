"use server";

import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/auth";
import { QR_MESSAGES, rpcCode } from "@/lib/qr-http";
import { deliverQrEmail } from "@/lib/qr-mail";
import { createClient } from "@/lib/supabase/server";

export type QrActionState = {
  error?: string;
  success?: string;
};

function revalidateCredential(registrationId?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/qr");
  revalidatePath("/admin/credentials");
  revalidatePath("/scan");
  if (registrationId) {
    revalidatePath(`/admin/participants/${registrationId}/qr/regenerate`);
  }
}

export async function resendQrEmailAction(
  registrationId: string,
  _prev: QrActionState,
  _formData: FormData,
): Promise<QrActionState> {
  void _formData;
  const result = await deliverQrEmail(registrationId);
  if (result.delivered) {
    return { success: "Credential email sent. Locally it lands in Mailpit on port 54324." };
  }
  return {
    error: result.error
      ? `${result.error} The QR is still valid in this dashboard.`
      : "Could not send email. The QR is still valid in this dashboard.",
  };
}

export async function regenerateQrAction(
  registrationId: string,
  _prev: QrActionState,
  formData: FormData,
): Promise<QrActionState> {
  const allowed = await hasPermission("qr.regenerate");
  if (!allowed) return { error: "You need qr.regenerate to issue a new credential." };
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 3) return { error: QR_MESSAGES.REASON_REQUIRED };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("regenerate_qr", {
    p_registration_id: registrationId,
    p_reason: reason,
  });
  if (error) {
    const code = rpcCode(error);
    return { error: QR_MESSAGES[code] ?? error.message };
  }
  await deliverQrEmail(registrationId);
  revalidateCredential(registrationId);
  const display =
    data && typeof data === "object" && "display_code" in data
      ? String((data as { display_code: string }).display_code)
      : "new code";
  return { success: `Revoked the previous QR. New display code: ${display}.` };
}
