import { describe, expect, it } from "vitest";
import {
  contactFaces,
  CORE_SECRETARIAT,
  coreFromMembers,
  defaultUsgDepartments,
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
    expect(splitOfficerNames("Nilanjana & Pratik")).toEqual(["Nilanjana", "Pratik"]);
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
    expect(coreFromMembers(rows)).toEqual([{ id: "1", role: "Secretary-General", names: ["Asha"] }]);
    expect(usgFromMembers(rows)).toEqual([{ id: "2", title: "Hospitality", names: [] }]);
    const roster = resolvePublicRoster(rows);
    expect(roster.core).toHaveLength(1);
    expect(roster.usgs).toHaveLength(1);
  });
});

describe("contactFaces", () => {
  it("expands co-holders into separate faces", () => {
    const faces = contactFaces([
      member({
        id: "sg",
        full_name: "Nilanjana & Pratik",
        role_title: "Secretary-General",
      }),
    ]);
    expect(faces.map((face) => face.full_name)).toEqual(["Nilanjana", "Pratik"]);
  });
});
