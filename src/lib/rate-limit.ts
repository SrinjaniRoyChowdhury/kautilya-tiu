const WINDOW_MS = 60_000;
const LIMIT = 40;
const hits = new Map<string, number[]>();

export const AUTH_WINDOW_MS = 15 * 60_000;
export const AUTH_LIMIT = 10;
export const SIGNUP_LIMIT = 8;
export const PAYMENT_LIMIT = 10;
export const PAYMENT_WINDOW_MS = 10 * 60_000;

export function clientKeyFromHeaders(headers: {
  get(name: string): string | null;
}): string {
  const forwarded = headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || headers.get("x-real-ip") || "local";
}

export function clientKeyFromRequest(request: Request): string {
  return clientKeyFromHeaders(request.headers);
}

export function rateLimit(key: string, limit = LIMIT, windowMs = WINDOW_MS): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

export function retryAfterHeader(windowMs: number): string {
  return String(Math.ceil(windowMs / 1000));
}

export function resetRateLimitForTests(): void {
  hits.clear();
}
