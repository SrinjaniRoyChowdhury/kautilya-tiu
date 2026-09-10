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
  if (
    envUrl &&
    !envUrl.includes("localhost") &&
    !envUrl.includes("127.0.0.1") &&
    !envUrl.includes("0.0.0.0")
  ) {
    return envUrl.replace(/\/+$/, "");
  }

  try {
    const headerList = await headers();
    let host = headerList.get("x-forwarded-host") || headerList.get("host");
    if (host) {
      if (host.includes("0.0.0.0")) {
        host = host.replace("0.0.0.0", "localhost");
      }
      const proto =
        headerList.get("x-forwarded-proto") ||
        (host && !host.includes("localhost") && !host.includes("127.0.0.1")
          ? "https"
          : "http");

      return `${proto}://${host}`;
    }
  } catch {
    // headers() may throw if called outside a request context
  }

  if (envUrl) {
    let clean = envUrl.replace(/\/+$/, "");
    if (clean.includes("0.0.0.0")) {
      clean = clean.replace("0.0.0.0", "localhost");
    }
    return clean;
  }

  return "http://localhost:3000";
}
