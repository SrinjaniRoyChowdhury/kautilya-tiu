import { NextResponse } from "next/server";
import { hasPermission } from "@/lib/auth";
import { QR_MESSAGES, qrHttpStatus, rpcCode } from "@/lib/qr-http";
import { deliverQrEmail } from "@/lib/qr-mail";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const allowed = await hasPermission("qr.regenerate");
  if (!allowed) {
    return NextResponse.json({ code: "FORBIDDEN" }, { status: 403 });
  }

  let reason = "";
  try {
    const body = (await request.json()) as { reason?: string };
    reason = String(body.reason ?? "").trim();
  } catch {
    reason = "";
  }
  if (reason.length < 3) {
    return NextResponse.json({ code: "REASON_REQUIRED" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("regenerate_qr", {
    p_registration_id: id,
    p_reason: reason,
  });
  if (error) {
    const code = rpcCode(error);
    return NextResponse.json(
      { code, error: QR_MESSAGES[code] ?? error.message },
      { status: qrHttpStatus(code) },
    );
  }
  await deliverQrEmail(id);
  return NextResponse.json(data);
}
