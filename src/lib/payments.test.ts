import { describe, expect, it } from "vitest";
import { classifyAmountFlag, parseEmailList } from "./payments";

describe("parseEmailList", () => {
  it("splits, lowercases, and de-duplicates", () => {
    expect(parseEmailList("A@x.com, b@x.com; A@x.com\nc@x.com")).toEqual([
      "a@x.com",
      "b@x.com",
      "c@x.com",
    ]);
  });
});

describe("classifyAmountFlag", () => {
  it("flags under, exact, over, and unknown", () => {
    expect(classifyAmountFlag(50000, 40000)).toBe("UNDERPAID");
    expect(classifyAmountFlag(50000, 50000)).toBe("EXACT");
    expect(classifyAmountFlag(50000, 60000)).toBe("OVERPAID");
    expect(classifyAmountFlag(50000, null)).toBe("UNKNOWN");
  });
});
