import { describe, expect, it } from "vitest";
import {
  buildRegistrationSchema,
  isCommitteeRegistrationLive,
  isPayableRegistration,
  isPreAllocationStatus,
  isRegistrationOpen,
  needsConferenceRulesAcceptance,
  parsePreferencesFromForm,
  seatsHeld,
} from "./registration";

describe("isRegistrationOpen", () => {
  const base = {
    status: "PUBLISHED",
    registration_open_at: "2020-01-01T00:00:00.000Z",
    registration_close_at: "2099-01-01T00:00:00.000Z",
  };

  it("opens only published editions inside the window", () => {
    expect(isRegistrationOpen(base)).toBe("open");
    expect(isRegistrationOpen({ ...base, status: "DRAFT" })).toBe("closed");
    expect(isRegistrationOpen({ ...base, registration_status: "CLOSED" })).toBe("closed");
    expect(
      isRegistrationOpen({
        ...base,
        registration_open_at: "2099-01-01T00:00:00.000Z",
      }),
    ).toBe("not_open");
  });
});

describe("isCommitteeRegistrationLive", () => {
  const edition = {
    status: "PUBLISHED",
    registration_open_at: "2020-01-01T00:00:00.000Z",
    registration_close_at: "2099-01-01T00:00:00.000Z",
    registration_status: "OPEN",
  };

  it("is live when edition and committee are open", () => {
    expect(isCommitteeRegistrationLive(edition, { status: "OPEN" })).toBe(true);
  });

  it("is not live when edition registration is closed", () => {
    expect(
      isCommitteeRegistrationLive(
        { ...edition, registration_status: "CLOSED" },
        { status: "OPEN" },
      ),
    ).toBe(false);
  });

  it("is not live when committee is closed or hidden", () => {
    expect(isCommitteeRegistrationLive(edition, { status: "CLOSED" })).toBe(false);
    expect(isCommitteeRegistrationLive(edition, { status: "HIDDEN" })).toBe(false);
  });
});

describe("buildRegistrationSchema", () => {
  const committeeA = "11111111-1111-4111-8111-111111111111";
  const committeeB = "22222222-2222-4222-8222-222222222222";
  const collective = "33333333-3333-4333-8333-333333333333";
  const preferences = [
    { committee_id: committeeA, portfolio_1: "USA", portfolio_2: "UK" },
    { committee_id: committeeB, portfolio_1: "India" },
  ];
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

  it("requires food preference and at least two committee preferences", () => {
    const schema = buildRegistrationSchema([]);
    expect(
      schema.safeParse({
        food_preference: "VEG",
        preferences: [{ committee_id: committeeA, portfolio_1: "USA" }],
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        food_preference: "VEG",
        preferences,
      }).success,
    ).toBe(true);
  });

  it("rejects the same portfolio twice on one committee", () => {
    const schema = buildRegistrationSchema([]);
    expect(
      schema.safeParse({
        food_preference: "VEG",
        preferences: [
          { committee_id: committeeA, portfolio_1: "USA", portfolio_2: "usa" },
          { committee_id: committeeB, portfolio_1: "India" },
        ],
      }).success,
    ).toBe(false);
  });

  it("requires an institution unless a collective is selected", () => {
    const schema = buildRegistrationSchema([institutionField]);
    const base = { food_preference: "VEG" as const, preferences };
    expect(schema.safeParse({ ...base, institution: "" }).success).toBe(false);
    expect(
      schema.safeParse({
        ...base,
        institution: "",
        collective_id: collective,
      }).success,
    ).toBe(true);
    expect(schema.safeParse({ ...base, institution: "TIU" }).success).toBe(true);
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
    const base = { food_preference: "VEG" as const, preferences };
    expect(schema.safeParse({ ...base, emergency_contact: "9876543210" }).success).toBe(true);
    expect(schema.safeParse({ ...base, emergency_contact: "+919876543210" }).success).toBe(false);
    expect(schema.safeParse({ ...base, emergency_contact: "987654321" }).success).toBe(false);
    expect(schema.safeParse({ ...base, emergency_contact: "98765-43210" }).success).toBe(false);
  });

  it("requires MUN experience details unless experience is None", () => {
    const schema = buildRegistrationSchema([
      {
        id: "field-mun",
        edition_id: "edition",
        field_key: "mun_experience",
        label: "Prior MUN experience",
        field_type: "select" as const,
        required: true,
        options: ["None", "1–3 conferences", "4–8 conferences", "9+ conferences"],
        validation: null,
        display_order: 4,
        section: "MUN_INFO" as const,
      },
      {
        id: "field-mun-details",
        edition_id: "edition",
        field_key: "mun_experience_details",
        label: "Prior MUN experience details",
        field_type: "text" as const,
        required: false,
        options: null,
        validation: { max: 2000 },
        display_order: 5,
        section: "MUN_INFO" as const,
      },
    ]);
    const base = { food_preference: "VEG" as const, preferences };
    expect(
      schema.safeParse({ ...base, mun_experience: "None", mun_experience_details: "" }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        ...base,
        mun_experience: "1–3 conferences",
        mun_experience_details: "",
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        ...base,
        mun_experience: "1–3 conferences",
        mun_experience_details: "NITISABHA 2025 : Loksabha : Narendra Modi : Best Delegate",
      }).success,
    ).toBe(true);
  });
});

describe("parsePreferencesFromForm", () => {
  it("reads ordered committee and portfolio fields", () => {
    const fd = new FormData();
    fd.set("preference_count", "2");
    fd.set("preference_0_committee_id", "11111111-1111-4111-8111-111111111111");
    fd.set("preference_0_portfolio_1", "USA");
    fd.set("preference_1_committee_id", "22222222-2222-4222-8222-222222222222");
    fd.set("preference_1_portfolio_1", "India");
    fd.set("preference_1_portfolio_2", "France");
    expect(parsePreferencesFromForm(fd)).toEqual([
      { committee_id: "11111111-1111-4111-8111-111111111111", portfolio_1: "USA", portfolio_2: "" },
      {
        committee_id: "22222222-2222-4222-8222-222222222222",
        portfolio_1: "India",
        portfolio_2: "France",
      },
    ]);
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

describe("payable and allocation gates", () => {
  it("locks payment until allocation", () => {
    expect(isPayableRegistration("SUBMITTED")).toBe(false);
    expect(isPayableRegistration("PAYMENT_PENDING")).toBe(true);
    expect(isPreAllocationStatus("SUBMITTED")).toBe(true);
    expect(isPreAllocationStatus("PAYMENT_PENDING")).toBe(false);
  });
});
