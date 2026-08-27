import { describe, expect, it } from "vitest";
import { buildRegistrationSchema, isRegistrationOpen, needsConferenceRulesAcceptance, seatsHeld } from "./registration";

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
  const committee = "11111111-1111-4111-8111-111111111111";
  const collective = "22222222-2222-4222-8222-222222222222";
  const institutionField = {
    id: "field-institution",
    edition_id: "edition",
    field_key: "institution",
    label: "Institution / College",
    field_type: "text" as const,
    required: true,
    options: null,
    validation: { min: 2, max: 120 },
    display_order: 1,
    section: "PERSONAL" as const,
  };

  it("requires food preference and a committee", () => {
    const schema = buildRegistrationSchema([]);
    const parsed = schema.safeParse({ committee_id: "not-uuid", food_preference: "VEG" });
    expect(parsed.success).toBe(false);
    expect(
      schema.safeParse({
        committee_id: committee,
        food_preference: "VEG",
      }).success,
    ).toBe(true);
  });

  it("requires an institution unless a collective is selected", () => {
    const schema = buildRegistrationSchema([institutionField]);
    expect(
      schema.safeParse({
        committee_id: committee,
        food_preference: "VEG",
        institution: "",
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        committee_id: committee,
        food_preference: "VEG",
        institution: "",
        collective_id: collective,
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        committee_id: committee,
        food_preference: "VEG",
        institution: "TIU",
      }).success,
    ).toBe(true);
  });
});

describe("needsConferenceRulesAcceptance", () => {
  it("asks only when first starting a draft", () => {
    expect(needsConferenceRulesAcceptance({ status: "DRAFT", accepted_rules_at: null })).toBe(true);
    expect(
      needsConferenceRulesAcceptance({
        status: "DRAFT",
        accepted_rules_at: "2026-01-01T00:00:00.000Z",
      }),
    ).toBe(false);
    expect(needsConferenceRulesAcceptance({ status: "PAYMENT_VERIFIED", accepted_rules_at: null })).toBe(
      false,
    );
    expect(needsConferenceRulesAcceptance({ status: "CONFIRMED", accepted_rules_at: null })).toBe(false);
  });
});

describe("seatsHeld", () => {
  it("prefers occupancy over confirmed_count", () => {
    expect(seatsHeld(12, 3)).toBe(12);
    expect(seatsHeld(undefined, 3)).toBe(3);
  });
});
