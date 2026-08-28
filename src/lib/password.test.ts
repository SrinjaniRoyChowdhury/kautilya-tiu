import { describe, expect, it } from "vitest";
import { confirmPasswordSchema, passwordSchema } from "./password";

describe("passwordSchema", () => {
  it("accepts a mixed 8-character password", () => {
    expect(passwordSchema.safeParse("Abcd1234").success).toBe(true);
  });

  it("rejects short or missing character classes", () => {
    expect(passwordSchema.safeParse("Ab1").success).toBe(false);
    expect(passwordSchema.safeParse("abcdefgh").success).toBe(false);
    expect(passwordSchema.safeParse("ABCDEFG1").success).toBe(false);
    expect(passwordSchema.safeParse("Abcdefgh").success).toBe(false);
  });
});

describe("confirmPasswordSchema", () => {
  it("requires the confirmation to match", () => {
    expect(
      confirmPasswordSchema.safeParse({ password: "Abcd1234", confirm_password: "Abcd1234" }).success,
    ).toBe(true);
    const mismatch = confirmPasswordSchema.safeParse({
      password: "Abcd1234",
      confirm_password: "Abcd1235",
    });
    expect(mismatch.success).toBe(false);
    if (!mismatch.success) {
      expect(mismatch.error.issues[0]?.path).toEqual(["confirm_password"]);
    }
  });
});
