import { describe, expect, it } from "vitest";
import { rupeesToMinor, seatsRemaining, slugify, hour12To24, localDateTimeValue, istDateTimeToIso, formatDateTime12h } from "./format";

describe("format helpers", () => {
  it("converts rupees to minor units", () => {
    expect(rupeesToMinor(1500)).toBe(150000);
  });

  it("converts 12-hour clock to 24-hour", () => {
    expect(hour12To24(12, "AM")).toBe(0);
    expect(hour12To24(1, "AM")).toBe(1);
    expect(hour12To24(12, "PM")).toBe(12);
    expect(hour12To24(1, "PM")).toBe(13);
    expect(localDateTimeValue("2026-08-25", 7, 5, "PM")).toBe("2026-08-25T19:05");
    expect(localDateTimeValue("", 7, 5, "PM")).toBe("");
  });

  it("stores and displays IST 12-hour times", () => {
    expect(istDateTimeToIso("2026-08-25T19:05")).toBe("2026-08-25T13:35:00.000Z");
    expect(istDateTimeToIso("nope")).toBeNull();
    expect(formatDateTime12h("2026-08-25T13:35:00.000Z")).toMatch(/7:05/i);
    expect(formatDateTime12h(null)).toBe("Not provided");
  });

  it("never returns negative remaining seats", () => {
    expect(seatsRemaining(40, 41)).toBe(0);
    expect(seatsRemaining(40, 10)).toBe(30);
  });

  it("slugifies names", () => {
    expect(slugify("UN Security Council")).toBe("un-security-council");
  });
});
