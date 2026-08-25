import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("site_settings").select("id").limit(1);
    if (error) {
      return NextResponse.json(
        { ok: false, service: "kautilya-web", check: "ready", db: "error" },
        { status: 503 },
      );
    }
    return NextResponse.json({
      ok: true,
      service: "kautilya-web",
      check: "ready",
      db: "up",
    });
  } catch {
    return NextResponse.json(
      { ok: false, service: "kautilya-web", check: "ready", db: "error" },
      { status: 503 },
    );
  }
}
