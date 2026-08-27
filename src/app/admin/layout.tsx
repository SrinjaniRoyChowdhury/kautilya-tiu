import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminPathGuard } from "@/components/admin/admin-path-guard";
import { getRoleNames, hasScanAccess, isStaffUser } from "@/lib/auth";
import { isOperatorOnly } from "@/lib/roles";
import { staffHomePath, staffNavItems } from "@/lib/staff-access";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const staff = await isStaffUser();
  if (!staff) redirect("/dashboard");
  const roles = await getRoleNames();
  if (isOperatorOnly(roles)) redirect("/scan");
  const canScan = await hasScanAccess();
  return (
    <div className="flex h-[calc(100dvh-var(--site-header-height))] flex-col overflow-hidden md:flex-row">
      <AdminPathGuard roles={roles} home={staffHomePath(roles)} />
      <AdminNav items={staffNavItems(roles)} canScan={canScan} />
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
