import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { hasScanAccess, isStaffUser } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const staff = await isStaffUser();
  if (!staff) redirect("/dashboard");
  const canScan = await hasScanAccess();
  return (
    <div className="flex h-[calc(100dvh-var(--site-header-height))] flex-col overflow-hidden md:flex-row">
      <AdminNav canScan={canScan} />
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
