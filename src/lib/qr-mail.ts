import { APP_NAME } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { deliverLocalEmail } from "@/lib/mail";
import { qrPngBase64, qrPngDataUrl, renderTemplate } from "@/lib/qr";

type TemplateRow = { subject: string; body_html: string };

export async function getActiveQrPayload(registrationId: string): Promise<{
  token: string;
  displayCode: string;
  dataUrl: string;
} | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("qr_tokens")
    .select("token, display_code, status")
    .eq("registration_id", registrationId)
    .eq("status", "ACTIVE")
    .maybeSingle();
  if (!data?.token) return null;
  const dataUrl = await qrPngDataUrl(data.token);
  return { token: data.token, displayCode: data.display_code, dataUrl };
}

async function loadTemplate(editionId: string | null): Promise<TemplateRow> {
  const supabase = await createClient();
  if (editionId) {
    const { data } = await supabase
      .from("email_templates")
      .select("subject, body_html")
      .eq("key", "QR_ISSUED")
      .eq("edition_id", editionId)
      .maybeSingle();
    if (data) return data as TemplateRow;
  }
  const { data: global } = await supabase
    .from("email_templates")
    .select("subject, body_html")
    .eq("key", "QR_ISSUED")
    .is("edition_id", null)
    .maybeSingle();
  return (
    (global as TemplateRow | null) ?? {
      subject: `Your ${APP_NAME} credential — {{display_code}}`,
      body_html:
        "<p>Dear {{full_name}},</p><p>You are confirmed for <strong>{{committee_name}}</strong>. Credential: <strong>{{display_code}}</strong>.</p><p>Open {{app_url}}/dashboard/qr</p>",
    }
  );
}

export async function deliverQrEmail(registrationId: string): Promise<{
  delivered: boolean;
  error?: string;
}> {
  const supabase = await createClient();
  const { data: reg } = await supabase
    .from("registrations")
    .select("id, edition_id, user_id, status, committees:committee_id (name, short_name)")
    .eq("id", registrationId)
    .maybeSingle();
  if (!reg || reg.status !== "CONFIRMED") {
    return { delivered: false, error: "NOT_CONFIRMED_YET" };
  }
  const { data: profile } = await supabase
    .from("users")
    .select("email, full_name")
    .eq("id", reg.user_id)
    .maybeSingle();
  if (!profile?.email) return { delivered: false, error: "No email on file." };

  const credential = await getActiveQrPayload(registrationId);
  if (!credential) return { delivered: false, error: "No active QR." };

  const committee = Array.isArray(reg.committees) ? reg.committees[0] : reg.committees;
  const template = await loadTemplate(reg.edition_id);
  const vars = {
    full_name: profile.full_name,
    committee_name: committee?.name ?? "your committee",
    display_code: credential.displayCode,
    app_url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  };
  const result = await deliverLocalEmail({
    to: profile.email,
    toName: profile.full_name,
    subject: renderTemplate(template.subject, vars),
    html: renderTemplate(template.body_html, vars),
    pngBase64: qrPngBase64(credential.dataUrl),
  });

  await supabase.rpc("record_qr_email_result", {
    p_registration_id: registrationId,
    p_delivered: result.delivered,
    p_error: result.error ?? null,
  });

  return result;
}

export async function deliverQrEmailsForPayment(paymentId: string): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payment_participants")
    .select("registration_id")
    .eq("payment_id", paymentId)
    .not("registration_id", "is", null);
  for (const row of data ?? []) {
    if (row.registration_id) {
      await deliverQrEmail(row.registration_id);
    }
  }
}
