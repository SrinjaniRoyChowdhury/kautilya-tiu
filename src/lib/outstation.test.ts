import { describe, expect, it } from "vitest";
import {
  normalizeOutstationPayload,
  outstationSummary,
  suggestedOutstationFeeMinor,
} from "./outstation";

describe("normalizeOutstationPayload", () => {
  it("clears related fields when not outstation", () => {
    expect(
      normalizeOutstationPayload({
        is_outstation: false,
        outstation_student_type: "COLLEGE",
        outstation_needs_accommodation: true,
        outstation_check_in: "NOV_26_NIGHT",
      }),
    ).toEqual({
      is_outstation: false,
      outstation_student_type: null,
      outstation_needs_accommodation: false,
      outstation_check_in: null,
    });
  });

  it("keeps school without accommodation", () => {
    expect(
      normalizeOutstationPayload({
        is_outstation: true,
        outstation_student_type: "SCHOOL",
        outstation_needs_accommodation: true,
        outstation_check_in: "NOV_27_MORNING",
      }),
    ).toEqual({
      is_outstation: true,
      outstation_student_type: "SCHOOL",
      outstation_needs_accommodation: false,
      outstation_check_in: null,
    });
  });

  it("keeps college accommodation with check-in", () => {
    expect(
      normalizeOutstationPayload({
        is_outstation: true,
        outstation_student_type: "COLLEGE",
        outstation_needs_accommodation: true,
        outstation_check_in: "NOV_26_NIGHT",
      }),
    ).toEqual({
      is_outstation: true,
      outstation_student_type: "COLLEGE",
      outstation_needs_accommodation: true,
      outstation_check_in: "NOV_26_NIGHT",
    });
  });
});

describe("outstationSummary", () => {
  it("returns null for local delegates", () => {
    expect(outstationSummary({ is_outstation: false })).toBeNull();
  });

  it("summarizes college accommodation", () => {
    expect(
      outstationSummary({
        is_outstation: true,
        outstation_student_type: "COLLEGE",
        outstation_needs_accommodation: true,
        outstation_check_in: "NOV_27_MORNING",
      }),
    ).toContain("College student");
  });
});

describe("suggestedOutstationFeeMinor", () => {
  it("returns null for local delegates", () => {
    expect(suggestedOutstationFeeMinor({ is_outstation: false })).toBeNull();
  });

  it("prices school students at 15000", () => {
    expect(
      suggestedOutstationFeeMinor({
        is_outstation: true,
        outstation_student_type: "SCHOOL",
      }),
    ).toBe(1_500_000);
  });

  it("prices college without accommodation at 2500", () => {
    expect(
      suggestedOutstationFeeMinor({
        is_outstation: true,
        outstation_student_type: "COLLEGE",
        outstation_needs_accommodation: false,
      }),
    ).toBe(250_000);
  });

  it("prices college accommodation by check-in", () => {
    expect(
      suggestedOutstationFeeMinor({
        is_outstation: true,
        outstation_student_type: "COLLEGE",
        outstation_needs_accommodation: true,
        outstation_check_in: "NOV_26_NIGHT",
      }),
    ).toBe(800_000);
    expect(
      suggestedOutstationFeeMinor({
        is_outstation: true,
        outstation_student_type: "COLLEGE",
        outstation_needs_accommodation: true,
        outstation_check_in: "NOV_27_MORNING",
      }),
    ).toBe(700_000);
  });

  it("returns null when college accommodation lacks check-in", () => {
    expect(
      suggestedOutstationFeeMinor({
        is_outstation: true,
        outstation_student_type: "COLLEGE",
        outstation_needs_accommodation: true,
        outstation_check_in: null,
      }),
    ).toBeNull();
  });
});
