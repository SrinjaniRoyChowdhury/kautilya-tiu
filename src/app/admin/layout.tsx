import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminPathGuard } from "@/components/admin/admin-path-guard";
import { getRoleNames, hasScanAccess } from "@/lib/auth";
import { isOperatorOnly } from "@/lib/roles";
import { staffHomePath, staffNavItems } from "@/lib/staff-access";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // getRoleNames / hasScanAccess share the cached getSessionUser from root layout.
  const [roles, canScan] = await Promise.all([getRoleNames(), hasScanAccess()]);
  if (!roles.length) redirect("/dashboard");
  if (isOperatorOnly(roles)) redirect("/scan");

  return (
    <div className="admin-surface relative z-10 flex h-[calc(100dvh-var(--site-header-height))] flex-col overflow-hidden bg-[#faf6ee] md:flex-row">
      <AdminPathGuard roles={roles} home={staffHomePath(roles)} />
      <AdminNav items={staffNavItems(roles)} canScan={canScan} />
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-[#faf6ee]">{children}</div>
    </div>
  );
}
