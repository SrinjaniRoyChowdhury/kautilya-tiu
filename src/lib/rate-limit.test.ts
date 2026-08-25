import { afterEach, describe, expect, it } from "vitest";
import { rateLimit, resetRateLimitForTests } from "./rate-limit";

describe("rateLimit", () => {
  afterEach(() => {
    resetRateLimitForTests();
  });

  it("allows traffic under the cap", () => {
    expect(rateLimit("a", 2, 60_000)).toBe(true);
    expect(rateLimit("a", 2, 60_000)).toBe(true);
  });

  it("blocks the next hit in the window", () => {
    rateLimit("b", 1, 60_000);
    expect(rateLimit("b", 1, 60_000)).toBe(false);
  });

  it("isolates keys", () => {
    rateLimit("one", 1, 60_000);
    expect(rateLimit("two", 1, 60_000)).toBe(true);
  });
});
