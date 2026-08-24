import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { isStaffUser } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const staff = await isStaffUser();
  if (!staff) redirect("/dashboard");
  return children;
}
