import { describe, expect, it } from "vitest";
import { buildRegistrationSchema, isRegistrationOpen, seatsHeld } from "./registration";

describe("isRegistrationOpen", () => {
  const base = {
    status: "PUBLISHED",
    registration_open_at: "2020-01-01T00:00:00.000Z",
    registration_close_at: "2099-01-01T00:00:00.000Z",
  };

  it("opens only published editions inside the window", () => {
    expect(isRegistrationOpen(base)).toBe("open");
    expect(isRegistrationOpen({ ...base, status: "DRAFT" })).toBe("closed");
    expect(
      isRegistrationOpen({
        ...base,
        registration_open_at: "2099-01-01T00:00:00.000Z",
      }),
    ).toBe("not_open");
  });
});

describe("buildRegistrationSchema", () => {
  it("requires food preference and a committee", () => {
    const schema = buildRegistrationSchema([]);
    const parsed = schema.safeParse({ committee_id: "not-uuid", food_preference: "VEG" });
    expect(parsed.success).toBe(false);
    expect(
      schema.safeParse({
        committee_id: "11111111-1111-4111-8111-111111111111",
        food_preference: "VEG",
      }).success,
    ).toBe(true);
  });
});

describe("seatsHeld", () => {
  it("prefers occupancy over confirmed_count", () => {
    expect(seatsHeld(12, 3)).toBe(12);
    expect(seatsHeld(undefined, 3)).toBe(3);
  });
});
