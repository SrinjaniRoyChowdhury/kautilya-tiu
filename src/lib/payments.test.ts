import { describe, expect, it } from "vitest";
import { classifyAmountFlag, parseEmailList, paymentQrSrc } from "./payments";

describe("parseEmailList", () => {
  it("splits, lowercases, and de-duplicates", () => {
    expect(parseEmailList("A@x.com, b@x.com; A@x.com\nc@x.com")).toEqual([
      "a@x.com",
      "b@x.com",
      "c@x.com",
    ]);
  });
});

describe("classifyAmountFlag", () => {
  it("flags under, exact, over, and unknown", () => {
    expect(classifyAmountFlag(50000, 40000)).toBe("UNDERPAID");
    expect(classifyAmountFlag(50000, 50000)).toBe("EXACT");
    expect(classifyAmountFlag(50000, 60000)).toBe("OVERPAID");
    expect(classifyAmountFlag(50000, null)).toBe("UNKNOWN");
  });
});

describe("paymentQrSrc", () => {
  it("returns a cache-busted same-origin URL only when a key exists", () => {
    expect(paymentQrSrc("ed-1", null)).toBeNull();
    expect(paymentQrSrc("ed-1", "payment-qr/ed-1.png")).toBe(
      "/api/pay/qr/ed-1?v=payment-qr%2Fed-1.png",
    );
  });
});
