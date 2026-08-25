export function matchesQuery(q: string, ...parts: Array<string | null | undefined>): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return parts.some((part) => (part ?? "").toLowerCase().includes(needle));
}

export const ADMIN_PAGE_SIZE = 20;

export function parsePage(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export function paginate<T>(items: T[], page: number, size = ADMIN_PAGE_SIZE) {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, page), pageCount);
  const start = (current - 1) * size;
  return {
    items: items.slice(start, start + size),
    page: current,
    pageCount,
    total,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(start + size, total),
  };
}

export function adminListHref(path: string, params: Record<string, string | undefined>, page = 1): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  if (page > 1) search.set("page", String(page));
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

export function istDayStartIso(date: string): string | null {
  const value = date.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00+05:30`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export function istDayEndIso(date: string): string | null {
  const value = date.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T23:59:59.999+05:30`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export function inDateRange(
  iso: string | null | undefined,
  from?: string,
  to?: string,
): boolean {
  if (!from && !to) return true;
  if (!iso) return false;
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return false;
  if (from) {
    const start = istDayStartIso(from);
    if (start && time < Date.parse(start)) return false;
  }
  if (to) {
    const end = istDayEndIso(to);
    if (end && time > Date.parse(end)) return false;
  }
  return true;
}
