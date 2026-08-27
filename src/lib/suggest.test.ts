import { describe, expect, it } from "vitest";
import { exactNameMatch, filterByTypedName } from "./suggest";

const items = [
  { id: "1", name: "Techno India University" },
  { id: "2", name: "Jadavpur University" },
  { id: "3", name: "Delhi Public School" },
];

describe("filterByTypedName", () => {
  it("filters character by character and prefers prefix matches", () => {
    expect(filterByTypedName(items, "").map((item) => item.id)).toEqual([]);
    expect(filterByTypedName(items, "t").map((item) => item.name)).toEqual(["Techno India University"]);
    expect(filterByTypedName(items, "te").map((item) => item.name)).toEqual(["Techno India University"]);
    expect(filterByTypedName(items, "uni").map((item) => item.id)).toEqual(["1", "2"]);
  });
});

describe("exactNameMatch", () => {
  it("matches ignoring case and surrounding space", () => {
    expect(exactNameMatch(items, "  delhi public school ")?.id).toBe("3");
    expect(exactNameMatch(items, "Unknown")).toBeNull();
  });
});
