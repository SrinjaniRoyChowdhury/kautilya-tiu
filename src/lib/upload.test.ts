import { describe, expect, it } from "vitest";
import { COMMITTEE_LOGO_PX, sniffImageMime, sniffPdf, validateCommitteeLogoBytes } from "./upload";

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

describe("validateCommitteeLogoBytes", () => {
  it("accepts a square 512×512 PNG header and rejects wrong sizes", () => {
    const bytes = new Uint8Array(24);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const view = new DataView(bytes.buffer);
    view.setUint32(16, COMMITTEE_LOGO_PX, false);
    view.setUint32(20, COMMITTEE_LOGO_PX, false);
    expect(validateCommitteeLogoBytes(bytes)).toBeNull();
    view.setUint32(20, 256, false);
    expect(validateCommitteeLogoBytes(bytes)).toContain("square");
    view.setUint32(20, COMMITTEE_LOGO_PX, false);
    view.setUint32(16, 400, false);
    view.setUint32(20, 400, false);
    expect(validateCommitteeLogoBytes(bytes)).toContain(`${COMMITTEE_LOGO_PX}×${COMMITTEE_LOGO_PX}`);
  });
});
