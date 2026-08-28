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

  it("accepts only a 10-digit emergency contact, digits only", () => {
    const schema = buildRegistrationSchema([
      {
        id: "field-phone",
        edition_id: "edition",
        field_key: "emergency_contact",
        label: "Emergency contact number",
        field_type: "text" as const,
        required: true,
        options: null,
        validation: { regex: "^[0-9+]{8,15}$" },
        display_order: 3,
        section: "PERSONAL" as const,
      },
    ]);
    const base = { committee_id: committee, food_preference: "VEG" as const };
    expect(schema.safeParse({ ...base, emergency_contact: "9876543210" }).success).toBe(true);
    expect(schema.safeParse({ ...base, emergency_contact: "+919876543210" }).success).toBe(false);
    expect(schema.safeParse({ ...base, emergency_contact: "987654321" }).success).toBe(false);
    expect(schema.safeParse({ ...base, emergency_contact: "98765-43210" }).success).toBe(false);
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
