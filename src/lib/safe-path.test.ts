import { describe, expect, it } from "vitest";
import { safeInternalPath, safeRedirectUrl, isStorageObjectKey } from "./safe-path";

describe("safeInternalPath", () => {
  it("keeps dashboard paths", () => {
    expect(safeInternalPath("/dashboard/qr")).toBe("/dashboard/qr");
  });

  it("rejects protocol-relative and off-site values", () => {
    expect(safeInternalPath("//evil.example")).toBe("/dashboard");
    expect(safeInternalPath("https://evil.example")).toBe("/dashboard");
    expect(safeInternalPath("/\\evil.example")).toBe("/dashboard");
    expect(safeInternalPath("/login?next=https://evil.example")).toBe("/dashboard");
  });
});

describe("isStorageObjectKey", () => {
  it("allows payment proof keys and rejects traversal", () => {
    expect(isStorageObjectKey("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/pay/1.jpg")).toBe(true);
    expect(isStorageObjectKey("../secret")).toBe(false);
    expect(isStorageObjectKey("/etc/passwd")).toBe(false);
  });
});

describe("safeRedirectUrl", () => {
  it("stays on the same origin", () => {
    const dest = safeRedirectUrl("http://localhost:3000", "/admin");
    expect(dest.toString()).toBe("http://localhost:3000/admin");
  });
});
