export function safeInternalPath(raw: unknown, fallback = "/dashboard"): string {
  const value = String(raw ?? "").trim();
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\0\r\n\\]/.test(value)) return fallback;
  if (value.includes("://")) return fallback;
  return value;
}

export function safeRedirectUrl(origin: string, next: unknown, fallback = "/dashboard"): URL {
  const cleanOrigin = origin.includes("0.0.0.0")
    ? origin.replace("0.0.0.0", "localhost")
    : origin;
  const path = safeInternalPath(next, fallback);
  const dest = new URL(path, cleanOrigin);
  const base = new URL(cleanOrigin);
  if (dest.origin !== base.origin) return new URL(fallback, cleanOrigin);
  return dest;
}

export function isStorageObjectKey(value: string): boolean {
  if (!value || value.length > 512) return false;
  if (value.includes("..") || value.startsWith("/") || value.includes("\\") || /[\0\r\n]/.test(value)) {
    return false;
  }
  return /^[A-Za-z0-9._/-]+$/.test(value);
}
