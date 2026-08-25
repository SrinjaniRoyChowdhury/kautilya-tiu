import { NextResponse } from "next/server";
import { hasScanAccess } from "@/lib/auth";
import { qrHttpStatus, rpcCode } from "@/lib/qr-http";
import { isOpaqueQrToken } from "@/lib/qr";
import { clientKeyFromRequest, rateLimit, retryAfterHeader } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  if (!rateLimit(`att:${clientKeyFromRequest(request)}`)) {
    return NextResponse.json(
      { code: "RATE_LIMITED" },
      { status: 429, headers: { "retry-after": retryAfterHeader(60_000) } },
    );
  }
  const body = await readJson(request);
  if (!(await hasScanAccess())) {
    return NextResponse.json({ code: "FORBIDDEN" }, { status: 403 });
  }
  const token = String(body?.token ?? "").trim();
  const eventDay = Number(body?.event_day);
  if (!token || !isOpaqueQrToken(token) || !Number.isInteger(eventDay)) {
    return NextResponse.json({ code: "QR_NOT_FOUND" }, { status: 404 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mark_attendance", {
    p_token: token,
    p_event_day: eventDay,
  });
  if (error) {
    const code = rpcCode(error);
    return NextResponse.json({ code }, { status: qrHttpStatus(code) });
  }
  const already = Boolean((data as { already?: boolean } | null)?.already);
  return NextResponse.json(data, { status: already ? 409 : 201 });
}
