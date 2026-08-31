import { NextResponse } from "next/server";
import { hasPermission } from "@/lib/auth";
import { isUuid } from "@/lib/ids";
import { clientKeyFromRequest, rateLimit, retryAfterHeader } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  if (!rateLimit(`rep-search:${clientKeyFromRequest(request)}`, 40, 60_000)) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { "retry-after": retryAfterHeader(60_000) } },
    );
  }

  if (!(await hasPermission("edition.manage"))) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const url = new URL(request.url);
  const edition = url.searchParams.get("edition") ?? "";
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  if (!isUuid(edition) || q.length < 1) {
    return NextResponse.json({ candidates: [] });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("registrations")
    .select("id, user_id, status, users:user_id (full_name, email)")
    .eq("edition_id", edition)
    .is("deleted_at", null)
    .in("status", ["SUBMITTED", "PAYMENT_PENDING", "PAYMENT_REJECTED"])
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  type Row = {
    id: string;
    user_id: string;
    status: string;
    users: { full_name: string; email: string } | { full_name: string; email: string }[] | null;
  };

  const candidates = ((data as Row[] | null) ?? [])
    .map((row) => {
      const user = Array.isArray(row.users) ? row.users[0] : row.users;
      return {
        registration_id: row.id,
        user_id: row.user_id,
        full_name: user?.full_name ?? "Delegate",
        email: user?.email ?? "",
        status: row.status,
      };
    })
    .filter(
      (row) =>
        row.email.toLowerCase().includes(q) ||
        row.full_name.toLowerCase().includes(q),
    )
    .slice(0, 15);

  return NextResponse.json({ candidates });
}
