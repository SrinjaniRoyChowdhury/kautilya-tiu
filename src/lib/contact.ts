export const VENUE = {
  name: "Techno India University",
  lines: ["EM-4/1, Sector V, Salt Lake City", "Kolkata, West Bengal 700091"],
  query: "Techno India University, EM-4/1, Sector V, Salt Lake, Kolkata",
} as const;

export const ARTHASHASTRA = {
  quote: "All undertakings should be preceded by counsel.",
  attribution: "Kautilya, Arthashastra",
} as const;

export const CONTACT_PEOPLE = [
  { name: "Bipul", label: "Help desk", phone: "9049064408" },
  { name: "Nilanjana", label: null, phone: "7439493303" },
  { name: "Pratik", label: null, phone: "9903693894" },
] as const;

export const HELP_DESK_PHONE = CONTACT_PEOPLE[0].phone;

export function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export const CONTACT_DESKS = [
  {
    id: "delegate",
    label: "Delegates",
    brief: "Allocations, seats, payments, and conference week logistics.",
  },
  {
    id: "partner",
    label: "Partners",
    brief: "Sponsorships, stalls, and collaboration with the society.",
  },
  {
    id: "press",
    label: "Press & faculty",
    brief: "Coverage, advisor letters, and institutional queries.",
  },
  {
    id: "other",
    label: "Everyone else",
    brief: "Anything that does not fit a desk still reaches the secretariat.",
  },
] as const;

export type ContactDeskId = (typeof CONTACT_DESKS)[number]["id"];

export function mapsOpenUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function mapsEmbedSrc(query: string) {
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=16&output=embed`;
}

export function instagramHandle(url: string) {
  try {
    const path = new URL(url).pathname.replace(/\//g, "");
    return path ? `@${path}` : "Instagram";
  } catch {
    return "Instagram";
  }
}

export function deskMailto(to: string, desk: ContactDeskId) {
  const subject =
    desk === "delegate"
      ? "Delegate desk — Niti Sabha"
      : desk === "partner"
        ? "Partnership enquiry — Niti Sabha"
        : desk === "press"
          ? "Press / faculty — Niti Sabha"
          : "Secretariat — Niti Sabha";
  return `mailto:${to}?subject=${encodeURIComponent(subject)}`;
}

export function letterMailto(opts: {
  to: string;
  name: string;
  email: string;
  desk: ContactDeskId;
  message: string;
}) {
  const deskLabel = CONTACT_DESKS.find((d) => d.id === opts.desk)?.label ?? "Secretariat";
  const subject = `[Niti Sabha · ${deskLabel}] ${opts.name}`;
  const body = `From: ${opts.name} <${opts.email}>\nDesk: ${deskLabel}\n\n${opts.message}\n`;
  return `mailto:${opts.to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
