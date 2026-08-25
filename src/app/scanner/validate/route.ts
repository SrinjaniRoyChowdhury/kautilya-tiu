import { NextResponse } from "next/server";
import { hasScanAccess } from "@/lib/auth";
import { qrHttpStatus, rpcCode } from "@/lib/qr-http";
import { rateLimit, clientKeyFromRequest, retryAfterHeader } from "@/lib/rate-limit";
import { isOpaqueQrToken } from "@/lib/qr";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!rateLimit(`scan:${clientKeyFromRequest(request)}`)) {
    return NextResponse.json(
      { code: "RATE_LIMITED" },
      { status: 429, headers: { "retry-after": retryAfterHeader(60_000) } },
    );
  }

  if (!(await hasScanAccess())) {
    return NextResponse.json({ code: "FORBIDDEN" }, { status: 403 });
  }

  let token = "";
  let eventDay: number | null = null;
  let mealScheduleId: string | null = null;
  try {
    const body = (await request.json()) as {
      token?: string;
      event_day?: number;
      meal_schedule_id?: string;
    };
    token = String(body.token ?? "").trim();
    if (body.event_day != null && Number.isInteger(Number(body.event_day))) {
      eventDay = Number(body.event_day);
    }
    if (body.meal_schedule_id) mealScheduleId = String(body.meal_schedule_id);
  } catch {
    return NextResponse.json({ code: "QR_NOT_FOUND" }, { status: 404 });
  }
  if (!token || !isOpaqueQrToken(token)) {
    return NextResponse.json({ code: "QR_NOT_FOUND" }, { status: 404 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("validate_qr_token", {
    p_token: token,
    p_event_day: eventDay,
    p_meal_schedule_id: mealScheduleId,
  });
  if (error) {
    const code = rpcCode(error);
    return NextResponse.json({ code }, { status: qrHttpStatus(code) });
  }
  return NextResponse.json(data);
}
