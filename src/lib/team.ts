import type { TeamMember, TeamSection } from "@/types";

export const CLUB_NAME = "Kautilya";
export const EVENT_NAME = "Niti Sabha";
export const EVENT_EDITION = "2.0";
export const HOST_UNIVERSITY = "Techno India University";

export type CoreOfficer = {
  id: string;
  role: string;
  names: string[];
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

export function contactFaces(members: TeamMember[]): TeamMember[] {
  const core = ofSection(members, "CORE").filter((member) => member.full_name.trim());
  if (!core.length) return HARDCODED_TEAM;
  return core.flatMap((member) =>
    splitOfficerNames(member.full_name).map((name, index) => ({
      ...member,
      id: `${member.id}-${index}`,
      full_name: name,
    })),
  );
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
