import { describe, expect, it } from "vitest";
import { inDateRange, istDayEndIso, istDayStartIso, matchesQuery, paginate, parsePage } from "./search";
import { canonicalMealName, isConferenceMeal } from "./meals";

describe("matchesQuery", () => {
  it("matches any haystack and ignores empty search", () => {
    expect(matchesQuery("", "Ada")).toBe(true);
    expect(matchesQuery("ada", "Ada Lovelace", "ada@example.com")).toBe(true);
    expect(matchesQuery("zz", "Ada")).toBe(false);
  });
});

describe("paginate", () => {
  it("slices a page and clamps out-of-range pages", () => {
    expect(parsePage("2")).toBe(2);
    expect(parsePage("nope")).toBe(1);
    const result = paginate(["a", "b", "c", "d"], 2, 2);
    expect(result.items).toEqual(["c", "d"]);
    expect(result.pageCount).toBe(2);
    expect(paginate(["a"], 9, 2).page).toBe(1);
  });
});

describe("date range IST", () => {
  it("converts calendar days in IST", () => {
    expect(istDayStartIso("2026-08-25")).toBe("2026-08-24T18:30:00.000Z");
    expect(istDayEndIso("2026-08-25")).toBe("2026-08-25T18:29:59.999Z");
    expect(inDateRange("2026-08-25T10:00:00.000Z", "2026-08-25", "2026-08-25")).toBe(true);
    expect(inDateRange("2026-08-24T10:00:00.000Z", "2026-08-25", "2026-08-25")).toBe(false);
  });
});

describe("conference meals", () => {
  it("keeps lunch and evening snacks only", () => {
    expect(canonicalMealName("lunch")).toBe("Lunch");
    expect(canonicalMealName("Snacks")).toBe("Evening snacks");
    expect(isConferenceMeal("Breakfast")).toBe(false);
  });
});
