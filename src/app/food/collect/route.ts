import { NextResponse } from "next/server";
import { hasScanAccess } from "@/lib/auth";
import { qrHttpStatus, rpcCode } from "@/lib/qr-http";
import { isOpaqueQrToken } from "@/lib/qr";
import { clientKeyFromRequest, rateLimit, retryAfterHeader } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!rateLimit(`food:${clientKeyFromRequest(request)}`)) {
    return NextResponse.json(
      { code: "RATE_LIMITED" },
      { status: 429, headers: { "retry-after": retryAfterHeader(60_000) } },
    );
  }
  if (!(await hasScanAccess())) {
    return NextResponse.json({ code: "FORBIDDEN" }, { status: 403 });
  }
  let token = "";
  let mealScheduleId = "";
  try {
    const body = (await request.json()) as { token?: string; meal_schedule_id?: string };
    token = String(body.token ?? "").trim();
    mealScheduleId = String(body.meal_schedule_id ?? "").trim();
  } catch {
    return NextResponse.json({ code: "QR_NOT_FOUND" }, { status: 404 });
  }
  if (!token || !isOpaqueQrToken(token)) {
    return NextResponse.json({ code: "QR_NOT_FOUND" }, { status: 404 });
  }
  if (!mealScheduleId) {
    return NextResponse.json({ code: "MEAL_REQUIRED" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("collect_food", {
    p_token: token,
    p_meal_schedule_id: mealScheduleId,
  });
  if (error) {
    const code = rpcCode(error);
    return NextResponse.json({ code }, { status: qrHttpStatus(code) });
  }
  const already = Boolean((data as { already?: boolean } | null)?.already);
  return NextResponse.json(data, { status: already ? 409 : 201 });
}
