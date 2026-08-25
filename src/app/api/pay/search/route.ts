import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isUuid } from "@/lib/ids";
import { clientKeyFromRequest, rateLimit, retryAfterHeader } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  if (!rateLimit(`pay-search:${clientKeyFromRequest(request)}`, 40, 60_000)) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { "retry-after": retryAfterHeader(60_000) } },
    );
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const url = new URL(request.url);
  const edition = url.searchParams.get("edition") ?? "";
  const q = (url.searchParams.get("q") ?? "").trim();
  if (!isUuid(edition)) {
    return NextResponse.json({ error: "Missing edition." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_payable_delegates", {
    p_edition_id: edition,
    p_query: q,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ delegates: parseDelegates(data) });
}

function parseDelegates(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (typeof data === "string") {
    try {
      const parsed: unknown = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}
