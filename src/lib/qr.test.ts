import { describe, expect, it } from "vitest";
import { isOpaqueQrToken, renderTemplate } from "./qr";

describe("QR helpers", () => {
  it("accepts 128-bit hex tokens and rejects display codes", () => {
    expect(isOpaqueQrToken("a".repeat(32))).toBe(true);
    expect(isOpaqueQrToken("MUN26-ABC123")).toBe(false);
    expect(isOpaqueQrToken("not-a-token")).toBe(false);
  });

  it("fills email templates without leftover braces for missing keys", () => {
    expect(renderTemplate("Hi {{full_name}}", { full_name: "Aarav" })).toBe("Hi Aarav");
  });
});
