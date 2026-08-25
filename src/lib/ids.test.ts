import { describe, expect, it } from "vitest";
import { isUuid } from "./ids";

describe("isUuid", () => {
  it("accepts hex 8-4-4-4-12 ids, including seed-style values", () => {
    expect(isUuid("cccccccc-cccc-cccc-cccc-cccccccccccc")).toBe(true);
    expect(isUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("rejects empty or malformed values", () => {
    expect(isUuid("")).toBe(false);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("cccccccc-cccc-cccc-cccc-ccccccccccc")).toBe(false);
  });
});
