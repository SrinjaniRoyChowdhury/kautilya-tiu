export function formatInrFromMinor(minor: number | null | undefined): string {
  const paise = minor ?? 0;
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
}

export function rupeesToMinor(rupees: number): number {
  return Math.round(rupees * 100);
}

export function hour12To24(hour12: number, meridiem: "AM" | "PM"): number {
  const hour = Math.min(12, Math.max(1, Math.trunc(hour12)));
  if (meridiem === "AM") return hour === 12 ? 0 : hour;
  return hour === 12 ? 12 : hour + 12;
}

export function localDateTimeValue(
  date: string,
  hour12: number,
  minute: number,
  meridiem: "AM" | "PM",
): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) return "";
  const mins = Math.min(59, Math.max(0, Math.trunc(minute)));
  const hour = hour12To24(hour12, meridiem);
  return `${date.trim()}T${String(hour).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function istDateTimeToIso(localValue: string): string | null {
  const trimmed = localValue.trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) return null;
  const parsed = new Date(`${trimmed}:00+05:30`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export function formatDateTime12h(iso?: string | null): string {
  if (!iso) return "Not provided";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "Not provided";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(parsed);
}

export function seatsRemaining(capacity: number, confirmedCount: number): number {
  return Math.max(capacity - confirmedCount, 0);
}

export function formatDateRange(start?: string | null, end?: string | null): string {
  if (!start && !end) return "Dates to be announced";
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  return fmt(start || end || "");
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
