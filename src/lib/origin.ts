import { headers } from "next/headers";

/**
 * Resolves the application origin dynamically for email redirect links and OAuth.
 * Priority:
 * 1. Explicit production NEXT_PUBLIC_APP_URL (if not localhost)
 * 2. Request headers (x-forwarded-host / host + x-forwarded-proto)
 * 3. NEXT_PUBLIC_APP_URL fallback or http://localhost:3000
 */
export async function getAppOrigin(): Promise<string> {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
    return envUrl.replace(/\/+$/, "");
  }

  try {
    const headerList = await headers();
    const host = headerList.get("x-forwarded-host") || headerList.get("host");
    const proto =
      headerList.get("x-forwarded-proto") ||
      (host && !host.includes("localhost") && !host.includes("127.0.0.1")
        ? "https"
        : "http");

    if (host) {
      return `${proto}://${host}`;
    }
  } catch {
    // headers() may throw if called outside a request context
  }

  return envUrl?.replace(/\/+$/, "") || "http://localhost:3000";
}
