import { describe, expect, it } from "vitest";
import { isAdminPathAllowed, staffHomePath, staffNavItems } from "./staff-access";

describe("staffNavItems", () => {
  it("gives scanners no admin nav", () => {
    expect(staffNavItems(["ATTENDANCE_OPERATOR"])).toEqual([]);
    expect(staffHomePath(["FOOD_OPERATOR"])).toBe("/scan");
    expect(isAdminPathAllowed("/admin/payments", ["ATTENDANCE_OPERATOR"])).toBe(false);
  });

  it("gives delegate affairs full read nav except accounts, and keeps operational paths", () => {
    const hrefs = staffNavItems(["DELEGATE_AFFAIRS"]).map((item) => item.href);
    expect(hrefs).not.toContain("/admin/accounts");
    expect(hrefs).toContain("/admin/payments");
    expect(hrefs).toContain("/admin/cms");
    expect(hrefs).toContain("/admin/attendance");
    expect(isAdminPathAllowed("/admin/cms", ["DELEGATE_AFFAIRS"])).toBe(true);
    expect(isAdminPathAllowed("/admin", ["DELEGATE_AFFAIRS"])).toBe(true);
    expect(isAdminPathAllowed("/admin/accounts", ["DELEGATE_AFFAIRS"])).toBe(false);
    expect(isAdminPathAllowed("/admin/participants/abc", ["DELEGATE_AFFAIRS"])).toBe(true);
    expect(staffHomePath(["DELEGATE_AFFAIRS"])).toBe("/admin/participants");
  });

  it("gives editors full read nav except accounts, and keeps content edit paths", () => {
    const hrefs = staffNavItems(["CONTENT_EDITOR"]).map((item) => item.href);
    expect(hrefs).not.toContain("/admin/accounts");
    expect(hrefs).toContain("/admin/cms");
    expect(hrefs).toContain("/admin/payments");
    expect(isAdminPathAllowed("/admin/committees/new", ["CONTENT_EDITOR"])).toBe(false);
    expect(isAdminPathAllowed("/admin/committees/abc", ["CONTENT_EDITOR"])).toBe(true);
    expect(isAdminPathAllowed("/admin", ["CONTENT_EDITOR"])).toBe(true);
    expect(isAdminPathAllowed("/admin/accounts", ["CONTENT_EDITOR"])).toBe(false);
    expect(staffHomePath(["CONTENT_EDITOR"])).toBe("/admin/cms");
  });

  it("gives viewers read nav without accounts", () => {
    const hrefs = staffNavItems(["VIEWER"]).map((item) => item.href);
    expect(hrefs).not.toContain("/admin/accounts");
    expect(hrefs).toContain("/admin/payments");
    expect(hrefs).toContain("/admin/cms");
    expect(isAdminPathAllowed("/admin/accounts", ["VIEWER"])).toBe(false);
    expect(isAdminPathAllowed("/admin/attendance", ["VIEWER"])).toBe(true);
    expect(isAdminPathAllowed("/admin/cms", ["VIEWER"])).toBe(true);
  });
});
