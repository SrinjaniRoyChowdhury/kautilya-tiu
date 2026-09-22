import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminPathGuard } from "@/components/admin/admin-path-guard";
import { getRoleNames, hasScanAccess, isCurrentUserSuperAdmin } from "@/lib/auth";
import { isOperatorOnly, isSuperAdmin } from "@/lib/roles";
import { staffHomePath, staffNavItems } from "@/lib/staff-access";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const [roles, canScan, isSuper] = await Promise.all([
    getRoleNames(),
    hasScanAccess(),
    isCurrentUserSuperAdmin(),
  ]);
  if (!roles.length) redirect("/dashboard");
  if (isOperatorOnly(roles)) redirect("/scan");

  // Protected bootstrap emails count as Super Admin even if role rows lag behind.
  const accessRoles =
    isSuper && !isSuperAdmin(roles) ? [...roles, "SUPER_ADMIN"] : roles;

  return (
    <div className="admin-surface relative z-10 flex h-[calc(100dvh-var(--site-header-height))] flex-col overflow-hidden bg-[#faf6ee] md:flex-row">
      <AdminPathGuard roles={accessRoles} home={staffHomePath(accessRoles)} />
      <AdminNav items={staffNavItems(accessRoles)} canScan={canScan} />
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-[#faf6ee]">{children}</div>
    </div>
  );
}
