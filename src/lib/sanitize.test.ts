import { describe, expect, it } from "vitest";
import { sanitizeHtml } from "./sanitize";

describe("sanitizeHtml", () => {
  it("strips script tags and event handlers", () => {
    const dirty = `<p>Hi</p><script>alert(1)</script><p onclick="alert(1)">x</p><a href="javascript:alert(1)">n</a>`;
    const clean = sanitizeHtml(dirty);
    expect(clean).toContain("<p>Hi</p>");
    expect(clean.toLowerCase()).not.toContain("script");
    expect(clean.toLowerCase()).not.toContain("onclick");
    expect(clean.toLowerCase()).not.toContain("javascript:");
  });

  it("returns empty for nullish input", () => {
    expect(sanitizeHtml(null)).toBe("");
  });
});
