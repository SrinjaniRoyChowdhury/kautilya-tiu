import {
  hasFullAdminRole,
  isContentEditorOnly,
  isDelegateAffairsOnly,
  isOperatorOnly,
  isViewerOnly,
} from "@/lib/roles";

export const ADMIN_NAV_ITEMS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/editions", label: "Editions" },
  { href: "/admin/committees", label: "Committees" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/participants", label: "Participants" },
  { href: "/admin/collectives", label: "Collectives" },
  { href: "/admin/credentials", label: "Credentials" },
  { href: "/admin/expenses", label: "Expenses" },
  { href: "/admin/accounts", label: "Accounts" },
  { href: "/admin/attendance", label: "Venue" },
  { href: "/admin/cms", label: "Content" },
  { href: "/admin/team", label: "Team" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/audit", label: "Audit" },
] as const;

export type AdminNavItem = (typeof ADMIN_NAV_ITEMS)[number];

export { hasFullAdminRole, isContentEditorOnly } from "@/lib/roles";

const STAFF_READ_HREFS = new Set(
  ADMIN_NAV_ITEMS.filter((item) => item.href !== "/admin/accounts").map((item) => item.href),
);

export function staffHomePath(roles: string[]): string {
  if (isOperatorOnly(roles)) return "/scan";
  if (isContentEditorOnly(roles)) return "/admin/cms";
  if (isDelegateAffairsOnly(roles)) return "/admin/participants";
  if (isViewerOnly(roles)) return "/admin";
  return "/admin";
}

export function staffNavItems(roles: string[]): AdminNavItem[] {
  if (isOperatorOnly(roles)) return [];
  if (hasFullAdminRole(roles)) return [...ADMIN_NAV_ITEMS];
  if (isViewerOnly(roles) || isDelegateAffairsOnly(roles) || isContentEditorOnly(roles)) {
    return ADMIN_NAV_ITEMS.filter((item) => STAFF_READ_HREFS.has(item.href));
  }
  return [...ADMIN_NAV_ITEMS];
}

export function isAdminPathAllowed(pathname: string, roles: string[]): boolean {
  if (isOperatorOnly(roles)) return false;
  if (isContentEditorOnly(roles) && pathname.startsWith("/admin/committees/new")) return false;
  const allowed = new Set(staffNavItems(roles).map((item) => item.href));
  if (pathname === "/admin" || pathname === "/admin/") return allowed.has("/admin");
  const match = [...allowed]
    .filter((href) => href !== "/admin")
    .find((href) => pathname === href || pathname.startsWith(`${href}/`));
  return Boolean(match);
}

export function isLimitedStaff(roles: string[]): boolean {
  return isViewerOnly(roles) || isContentEditorOnly(roles) || isDelegateAffairsOnly(roles);
}

export function isReadOnlyStaff(roles: string[]): boolean {
  return isViewerOnly(roles);
}

export function canEditCommitteeContent(roles: string[]): boolean {
  return isContentEditorOnly(roles) || hasFullAdminRole(roles);
}
