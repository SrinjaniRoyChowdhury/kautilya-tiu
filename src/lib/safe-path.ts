export function safeInternalPath(raw: unknown, fallback = "/dashboard"): string {
  const value = String(raw ?? "").trim();
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\0\r\n\\]/.test(value)) return fallback;
  if (value.includes("://")) return fallback;
  return value;
}

export function safeRedirectUrl(origin: string, next: unknown, fallback = "/dashboard"): URL {
  const path = safeInternalPath(next, fallback);
  const dest = new URL(path, origin);
  const base = new URL(origin);
  if (dest.origin !== base.origin) return new URL(fallback, origin);
  return dest;
}

export function isStorageObjectKey(value: string): boolean {
  if (!value || value.length > 512) return false;
  if (value.includes("..") || value.startsWith("/") || value.includes("\\") || /[\0\r\n]/.test(value)) {
    return false;
  }
  return /^[A-Za-z0-9._/-]+$/.test(value);
}
