import { describe, expect, it } from "vitest";
import {
  contactFaces,
  CORE_SECRETARIAT,
  coreFromMembers,
  defaultUsgDepartments,
  expandTeamFaces,
  resolvePublicRoster,
  splitOfficerNames,
  usgFromMembers,
} from "./team";
import type { TeamMember } from "@/types";

const member = (overrides: Partial<TeamMember> & Pick<TeamMember, "id" | "full_name" | "role_title">): TeamMember => ({
  bio: null,
  photo_url: null,
  display_order: 0,
  section: "CORE",
  ...overrides,
});

describe("splitOfficerNames", () => {
  it("splits co-holders on &", () => {
    expect(splitOfficerNames("Pratik & Nilanjana")).toEqual(["Pratik", "Nilanjana"]);
  });

  it("keeps a single name", () => {
    expect(splitOfficerNames("Chirag")).toEqual(["Chirag"]);
  });
});

describe("resolvePublicRoster", () => {
  it("falls back to the hardcoded roster when CMS is empty", () => {
    expect(resolvePublicRoster([])).toEqual({
      core: CORE_SECRETARIAT,
      usgs: defaultUsgDepartments(),
    });
  });

  it("uses CMS core and USG rows independently", () => {
    const rows = [
      member({ id: "1", section: "CORE", full_name: "Asha", role_title: "Secretary-General" }),
      member({ id: "2", section: "USG", full_name: "", role_title: "Hospitality" }),
    ];
    expect(coreFromMembers(rows)).toEqual([
      { id: "1", role: "Secretary-General", names: ["Asha"], photo_url: null },
    ]);
    expect(usgFromMembers(rows)).toEqual([{ id: "2", title: "Hospitality", names: [] }]);
    const roster = resolvePublicRoster(rows);
    expect(roster.core).toHaveLength(1);
    expect(roster.usgs).toHaveLength(1);
  });
});

describe("contactFaces", () => {
  const roster = [
    member({
      id: "sg",
      full_name: "Pratik & Nilanjana",
      role_title: "Secretary-General",
    }),
    member({
      id: "cda",
      full_name: "Bipul",
      role_title: "Chargé d’Affaires",
      display_order: 20,
    }),
    member({
      id: "usg-1",
      section: "USG",
      full_name: "Meera",
      role_title: "Hospitality",
      display_order: 100,
    }),
  ];

  it("expands co-holders and falls back to first core faces with default limit 3", () => {
    const faces = contactFaces(roster);
    expect(faces.map((face) => face.full_name)).toEqual(["Pratik", "Nilanjana", "Bipul"]);
  });

  it("uses CMS order, drops stale refs, and respects display limit", () => {
    const faces = contactFaces(roster, {
      contact_desk_faces: [
        { member_id: "cda", name: "Bipul" },
        { member_id: "missing", name: "Ghost" },
        { member_id: "sg", name: "Nilanjana" },
        { member_id: "usg-1", name: "Meera" },
        { member_id: "sg", name: "Pratik" },
      ],
      contact_desk_limit: 2,
    });
    expect(faces.map((face) => face.full_name)).toEqual(["Bipul", "Nilanjana"]);
  });

  it("falls back when every CMS ref is stale", () => {
    const faces = contactFaces(roster, {
      contact_desk_faces: [{ member_id: "gone", name: "Nobody" }],
      contact_desk_limit: 1,
    });
    expect(faces.map((face) => face.full_name)).toEqual(["Pratik"]);
  });
});

describe("expandTeamFaces", () => {
  it("expands CORE and USG co-holders", () => {
    expect(
      expandTeamFaces([
        member({ id: "sg", full_name: "A & B", role_title: "SG" }),
        member({ id: "u", section: "USG", full_name: "C", role_title: "Hospitality" }),
      ]).map((face) => face.full_name),
    ).toEqual(["A", "B", "C"]);
  });
});
