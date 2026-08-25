import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getActiveEdition, getMyEventStatus, getMyRegistration } from "@/lib/data";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ code: "UNAUTHENTICATED" }, { status: 401 });
  }
  const edition = await getActiveEdition();
  const registration = edition ? await getMyRegistration(edition.id) : null;
  if (!registration) {
    return NextResponse.json({ attendance: [], meals: [] });
  }
  const status = await getMyEventStatus(registration.id);
  return NextResponse.json(status);
}
