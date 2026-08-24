import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("site_settings").select("id").limit(1);
    return NextResponse.json({
      ok: !error,
      db: error ? "error" : "up",
      service: "kautilya-web",
    });
  } catch {
    return NextResponse.json({ ok: false, db: "error", service: "kautilya-web" }, { status: 503 });
  }
}
