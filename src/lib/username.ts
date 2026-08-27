import { z } from "zod";

export const STAFF_EMAIL_DOMAIN = "staff.kautilya.local";

export const ACCOUNT_KINDS = ["scanner", "editor", "delegate_affairs", "viewer"] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];

export const ACCOUNT_KIND_LABELS: Record<AccountKind, string> = {
  scanner: "Scanner",
  editor: "Editor",
  delegate_affairs: "Delegate Affairs",
  viewer: "Viewer",
};

const RESERVED_USERNAMES = new Set(["admin", "administrator", "root", "superadmin", "support"]);

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Username must be at least 3 characters")
  .max(32, "Username must be at most 32 characters")
  .regex(
    /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/,
    "Use letters, numbers, and single dots, hyphens, or underscores",
  )
  .refine((value) => !RESERVED_USERNAMES.has(value), "That username is reserved");

export function staffEmailFromUsername(username: string) {
  return `${username.trim().toLowerCase()}@${STAFF_EMAIL_DOMAIN}`;
}

export function kindFromRoleNames(names: string[]): AccountKind | null {
  if (names.includes("ATTENDANCE_OPERATOR") || names.includes("FOOD_OPERATOR")) return "scanner";
  if (names.includes("CONTENT_EDITOR")) return "editor";
  if (names.includes("DELEGATE_AFFAIRS")) return "delegate_affairs";
  if (names.includes("VIEWER")) return "viewer";
  return null;
}

export function deskFromRoleNames(names: string[]): "attendance" | "food" | "both" | null {
  const attendance = names.includes("ATTENDANCE_OPERATOR");
  const food = names.includes("FOOD_OPERATOR");
  if (attendance && food) return "both";
  if (attendance) return "attendance";
  if (food) return "food";
  return null;
}

export function rolesForAccountKind(
  kind: AccountKind,
  desk: "attendance" | "food" | "both" = "both",
): string[] {
  if (kind === "scanner") {
    if (desk === "food") return ["FOOD_OPERATOR"];
    if (desk === "attendance") return ["ATTENDANCE_OPERATOR"];
    return ["ATTENDANCE_OPERATOR", "FOOD_OPERATOR"];
  }
  if (kind === "editor") return ["CONTENT_EDITOR"];
  if (kind === "delegate_affairs") return ["DELEGATE_AFFAIRS"];
  return ["VIEWER"];
}
