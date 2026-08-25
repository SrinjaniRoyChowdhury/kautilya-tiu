import { NextResponse } from "next/server";
import { getSessionUser, isStaffUser } from "@/lib/auth";
import { isUuid } from "@/lib/ids";
import { canDownloadCommitteeAllocations, committeeAllocationRows } from "@/lib/reports";
import { spreadsheetResponse } from "@/lib/sheet";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Unknown committee" }, { status: 400 });

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const staff = await isStaffUser();
  if (!staff) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const payload = await committeeAllocationRows(id);
  if (!payload) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const allowed = await canDownloadCommitteeAllocations(payload.editionId);
  if (!allowed) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const slug = payload.shortName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return spreadsheetResponse(
    `kautilya-${slug}-delegations.xls`,
    payload.headers,
    payload.rows,
    payload.shortName.slice(0, 31) || "Committee",
  );
}
