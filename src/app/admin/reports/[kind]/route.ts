import { NextResponse } from "next/server";
import { getSessionUser, isStaffUser } from "@/lib/auth";
import { getEditionById } from "@/lib/data";
import { canExportKind, csvForReport, REPORT_KINDS, type ReportKind } from "@/lib/reports";

type Params = { params: Promise<{ kind: string }> };

export async function GET(request: Request, { params }: Params) {
  const { kind: raw } = await params;
  const kind = raw as ReportKind;
  if (!REPORT_KINDS.includes(kind)) {
    return NextResponse.json({ error: "Unknown report" }, { status: 400 });
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  const staff = await isStaffUser();
  if (!staff) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const editionId = new URL(request.url).searchParams.get("edition");
  if (!editionId) {
    return NextResponse.json({ error: "edition is required" }, { status: 400 });
  }

  const allowed = await canExportKind(kind, editionId);
  if (!allowed) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const edition = await getEditionById(editionId);
  const slug = edition?.slug || editionId.slice(0, 8);
  return csvForReport(kind, editionId, slug);
}
