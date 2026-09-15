import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  if (host.includes("0.0.0.0")) {
    const localhostUrl = request.nextUrl.clone();
    localhostUrl.host = host.replace("0.0.0.0", "localhost");
    return NextResponse.redirect(localhostUrl);
  }

  const path = request.nextUrl.pathname;
  if (path !== "/auth/confirm") {
    const hasCode = request.nextUrl.searchParams.has("code");
    const hasToken =
      request.nextUrl.searchParams.has("token_hash") &&
      request.nextUrl.searchParams.has("type");
    if (hasCode || hasToken) {
      const confirmUrl = request.nextUrl.clone();
      confirmUrl.pathname = "/auth/confirm";
      if (!confirmUrl.searchParams.has("next")) {
        confirmUrl.searchParams.set("next", "/dashboard");
      }
      return NextResponse.redirect(confirmUrl);
    }
  }

  const local = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  if (
    !local &&
    appUrl.startsWith("https:") &&
    request.headers.get("x-forwarded-proto") === "http"
  ) {
    const httpsUrl = request.nextUrl.clone();
    httpsUrl.protocol = "https:";
    return NextResponse.redirect(httpsUrl, 308);
  }

  let supabaseResponse = NextResponse.next({
    request: {
      headers: (() => {
        const headers = new Headers(request.headers);
        headers.set("x-pathname", path);
        return headers;
      })(),
    },
  });
  const url =
    process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    return supabaseResponse;
  }

  const hasSessionHint = request.cookies
    .getAll()
    .some((cookie) => cookie.name.includes("auth-token"));

  const csvExport = /^\/admin\/reports\/[^/]+$/.test(path);
  const gated =
    path.startsWith("/dashboard") ||
    (path.startsWith("/admin") && !csvExport) ||
    path === "/scan" ||
    path.startsWith("/scan/");

  // Anonymous public routes: skip Auth round-trip when no session cookies exist.
  if (!hasSessionHint) {
    if (gated) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("next", path);
      return NextResponse.redirect(redirectUrl);
    }
    return supabaseResponse;
  }

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        const headers = new Headers(request.headers);
        headers.set("x-pathname", path);
        supabaseResponse = NextResponse.next({
          request: { headers },
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (gated && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", path);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && (path === "/login" || path === "/signup")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
