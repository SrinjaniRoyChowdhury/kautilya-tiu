import { describe, expect, it } from "vitest";
import { isParticipantPhoneField, isTenDigitPhone, tenDigitPhoneSchema } from "./phone";

describe("isTenDigitPhone", () => {
  it("accepts exactly 10 digits", () => {
    expect(isTenDigitPhone("9876543210")).toBe(true);
    expect(isTenDigitPhone(" 9876543210 ")).toBe(true);
  });

  it("rejects country codes, separators, and the wrong length", () => {
    expect(isTenDigitPhone("+919876543210")).toBe(false);
    expect(isTenDigitPhone("919876543210")).toBe(false);
    expect(isTenDigitPhone("98765-43210")).toBe(false);
    expect(isTenDigitPhone("98765 43210")).toBe(false);
    expect(isTenDigitPhone("987654321")).toBe(false);
    expect(isTenDigitPhone("98765432101")).toBe(false);
    expect(isTenDigitPhone("abcdefghij")).toBe(false);
    expect(isTenDigitPhone("")).toBe(false);
  });
});

describe("tenDigitPhoneSchema", () => {
  it("parses a 10-digit number", () => {
    expect(tenDigitPhoneSchema.safeParse("9876543210").success).toBe(true);
    expect(tenDigitPhoneSchema.safeParse("+919876543210").success).toBe(false);
  });
});

describe("isParticipantPhoneField", () => {
  it("matches signup and registration phone keys", () => {
    expect(isParticipantPhoneField("phone")).toBe(true);
    expect(isParticipantPhoneField("emergency_contact")).toBe(true);
    expect(isParticipantPhoneField("institution")).toBe(false);
  });
});
