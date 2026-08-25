import { NextResponse } from "next/server";
import { isStaffUser } from "@/lib/auth";
import { spreadsheetResponse } from "@/lib/sheet";

export async function GET() {
  const staff = await isStaffUser();
  if (!staff) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  return spreadsheetResponse(
    "kautilya-portfolio-matrix.xls",
    ["SLR No.", "Portfolio"],
    [
      [1, "France"],
      [2, "India"],
    ],
    "Portfolios",
  );
}
