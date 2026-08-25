import { NextResponse } from "next/server";
import { getActiveEdition, getMyRegistration } from "@/lib/data";
import { getSessionUser } from "@/lib/auth";
import { getActiveQrPayload } from "@/lib/qr-mail";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ code: "UNAUTHENTICATED" }, { status: 401 });
  }
  const edition = await getActiveEdition();
  const registration = edition ? await getMyRegistration(edition.id) : null;
  if (!registration || registration.status !== "CONFIRMED") {
    return NextResponse.json({ code: "NOT_CONFIRMED_YET" }, { status: 404 });
  }
  const payload = await getActiveQrPayload(registration.id);
  if (!payload) {
    return NextResponse.json({ code: "NOT_CONFIRMED_YET" }, { status: 404 });
  }
  return NextResponse.json({
    display_code: payload.displayCode,
    token: payload.token,
    image: payload.dataUrl,
  });
}
