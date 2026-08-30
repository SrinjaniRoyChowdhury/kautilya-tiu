import type { ContactDeskFaceRef, SiteSettings, TeamMember, TeamSection } from "@/types";

export const CLUB_NAME = "Kautilya MUN Nitisabha";
export const PRESENTER_LINE = "KAUTILYA MUN NITISABHA presents";
export const EVENT_NAME = "Kautilya";
export const EVENT_EDITION = "2026";
export const HOST_UNIVERSITY = "Techno India University";

export type CoreOfficer = {
  id: string;
  role: string;
  names: string[];
  photo_url?: string | null;
};

export type UsgDepartment = {
  id: string;
  title: string;
  names: string[];
};

export const CORE_SECRETARIAT: CoreOfficer[] = [
  { id: "sg", role: "Secretary-General", names: ["Pratik", "Nilanjana"] },
  { id: "dsg", role: "Deputy Secretary-General", names: ["Chirag"] },
  { id: "dg", role: "Director-General", names: ["Vaishnavi"] },
  { id: "cos", role: "Chief of Staff", names: ["Swapnil"] },
  { id: "cda", role: "Chargé d’Affaires", names: ["Bipul", "Sirsantika"] },
  { id: "equity", role: "Equity Officer", names: ["Pritam"] },
];

export const USG_DEPARTMENTS = [
  "Delegate Affairs",
  "Logistics & Operations",
  "Hospitality",
  "Marketing & External Outreach",
  "Media, Design & Creatives",
  "Communications & Documentation",
  "Finance & Sponsorships",
  "Administration & Management",
  "Executive Board & Committee Affairs",
] as const;

export function splitOfficerNames(value: string): string[] {
  return value
    .split(/\s*&\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function defaultUsgDepartments(): UsgDepartment[] {
  return USG_DEPARTMENTS.map((title, index) => ({
    id: `usg-${index}`,
    title,
    names: [],
  }));
}

function ofSection(members: TeamMember[], section: TeamSection): TeamMember[] {
  return members.filter((member) => (member.section ?? "CORE") === section);
}

export function coreFromMembers(members: TeamMember[]): CoreOfficer[] {
  return ofSection(members, "CORE")
    .map((member) => ({
      id: member.id,
      role: member.role_title,
      names: splitOfficerNames(member.full_name),
      photo_url: member.photo_url,
    }))
    .filter((officer) => officer.names.length > 0);
}

export function usgFromMembers(members: TeamMember[]): UsgDepartment[] {
  return ofSection(members, "USG").map((member) => ({
    id: member.id,
    title: member.role_title,
    names: splitOfficerNames(member.full_name),
  }));
}

export function resolvePublicRoster(members: TeamMember[]): {
  core: CoreOfficer[];
  usgs: UsgDepartment[];
} {
  const core = coreFromMembers(members);
  const usgs = usgFromMembers(members);
  return {
    core: core.length ? core : CORE_SECRETARIAT,
    usgs: usgs.length ? usgs : defaultUsgDepartments(),
  };
}

/** Expand team rows into individual contact faces (co-holders become separate entries). */
export function expandTeamFaces(members: TeamMember[]): TeamMember[] {
  return members
    .filter((member) => member.full_name.trim())
    .flatMap((member) =>
      splitOfficerNames(member.full_name).map((name, index) => ({
        ...member,
        id: `${member.id}-${index}`,
        full_name: name,
      })),
    );
}

function faceKey(memberId: string, name: string) {
  return `${memberId}\0${name.trim().toLowerCase()}`;
}

function resolveSelectedFaces(
  members: TeamMember[],
  refs: ContactDeskFaceRef[],
): TeamMember[] {
  const byKey = new Map<string, TeamMember>();
  for (const member of members) {
    if (!member.full_name.trim()) continue;
    for (const [index, name] of splitOfficerNames(member.full_name).entries()) {
      byKey.set(faceKey(member.id, name), {
        ...member,
        id: `${member.id}-${index}`,
        full_name: name,
      });
    }
  }

  const seen = new Set<string>();
  const resolved: TeamMember[] = [];
  for (const ref of refs) {
    const key = faceKey(ref.member_id, ref.name);
    if (seen.has(key)) continue;
    const face = byKey.get(key);
    if (!face) continue;
    seen.add(key);
    resolved.push(face);
  }
  return resolved;
}

function fallbackContactFaces(members: TeamMember[], limit: number): TeamMember[] {
  const core = expandTeamFaces(ofSection(members, "CORE"));
  if (core.length) return core.slice(0, limit);
  return HARDCODED_TEAM.slice(0, limit);
}

export function contactFaces(
  members: TeamMember[],
  settings?: Pick<SiteSettings, "contact_desk_faces" | "contact_desk_limit"> | null,
): TeamMember[] {
  const limit = normalizeLimit(settings?.contact_desk_limit);
  const refs = settings?.contact_desk_faces ?? [];
  if (refs.length) {
    const selected = resolveSelectedFaces(members, refs);
    if (selected.length) return selected.slice(0, limit);
  }
  return fallbackContactFaces(members, limit);
}

function normalizeLimit(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 3;
  return Math.min(24, Math.max(0, Math.trunc(value)));
}

export const HARDCODED_TEAM: TeamMember[] = CORE_SECRETARIAT.flatMap((officer, index) =>
  officer.names.map((name, nameIndex) => ({
    id: `${officer.id}-${nameIndex}`,
    section: "CORE" as const,
    full_name: name,
    role_title: officer.role,
    bio: null,
    photo_url: null,
    display_order: index * 10 + nameIndex,
  })),
);
