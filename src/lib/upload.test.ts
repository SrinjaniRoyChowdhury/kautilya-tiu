import { describe, expect, it } from "vitest";
import { sniffImageMime, sniffPdf } from "./upload";

describe("sniffImageMime", () => {
  it("detects JPEG/PNG/WebP magic bytes and rejects other bytes", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const webp = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
    ]);
    const exe = new Uint8Array([0x4d, 0x5a, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(sniffImageMime(jpeg)).toBe("image/jpeg");
    expect(sniffImageMime(png)).toBe("image/png");
    expect(sniffImageMime(webp)).toBe("image/webp");
    expect(sniffImageMime(exe)).toBeNull();
  });

  it("detects PDF magic bytes", () => {
    expect(sniffPdf(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]))).toBe(true);
    expect(sniffPdf(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0]))).toBe(false);
  });
});
