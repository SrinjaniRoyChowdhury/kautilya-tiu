import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { safeRedirectUrl } from "@/lib/safe-path";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const cleanOrigin = origin.includes("0.0.0.0")
    ? origin.replace("0.0.0.0", "localhost")
    : origin;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const dest = safeRedirectUrl(cleanOrigin, searchParams.get("next"), "/dashboard");

  const redirectWithToast = (destUrl: URL) => {
    destUrl.searchParams.set("toast", "email_confirmed");
    return NextResponse.redirect(destUrl.toString());
  };

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return redirectWithToast(dest);
    }
  }

  const code = searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return redirectWithToast(dest);
    }
  }

  return NextResponse.redirect(`${cleanOrigin}/login?error=invalid_token`);
}
