import { describe, expect, it } from "vitest";
import {
  deskFromRoleNames,
  kindFromRoleNames,
  rolesForAccountKind,
  staffEmailFromUsername,
  usernameSchema,
} from "./username";

describe("usernameSchema", () => {
  it("accepts simple staff usernames", () => {
    expect(usernameSchema.parse("desk1")).toBe("desk1");
    expect(usernameSchema.parse("Scan.Ops")).toBe("scan.ops");
  });

  it("rejects email-shaped or reserved values", () => {
    expect(usernameSchema.safeParse("ada@kautilya.local").success).toBe(false);
    expect(usernameSchema.safeParse("ab").success).toBe(false);
    expect(usernameSchema.safeParse("admin").success).toBe(false);
  });
});

describe("account kinds", () => {
  it("maps roles to kinds and desks", () => {
    expect(kindFromRoleNames(["ATTENDANCE_OPERATOR", "FOOD_OPERATOR"])).toBe("scanner");
    expect(kindFromRoleNames(["CONTENT_EDITOR"])).toBe("editor");
    expect(kindFromRoleNames(["DELEGATE_AFFAIRS"])).toBe("delegate_affairs");
    expect(kindFromRoleNames(["VIEWER"])).toBe("viewer");
    expect(deskFromRoleNames(["ATTENDANCE_OPERATOR"])).toBe("attendance");
    expect(rolesForAccountKind("scanner", "both")).toEqual(["ATTENDANCE_OPERATOR", "FOOD_OPERATOR"]);
    expect(staffEmailFromUsername("Desk1")).toBe("desk1@staff.kautilya.local");
  });
});
