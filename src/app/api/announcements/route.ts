import { NextResponse } from "next/server";
import { getActiveEdition, getAnnouncements } from "@/lib/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const edition = await getActiveEdition();
  const announcements = edition ? await getAnnouncements(edition.id) : [];

  return NextResponse.json(
    announcements.map((item) => ({
      id: item.id,
      title: item.title,
    })),
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
