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
