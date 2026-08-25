import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { hasScanAccess } from "@/lib/auth";

export default async function ScanLayout({ children }: { children: ReactNode }) {
  const allowed = await hasScanAccess();
  if (!allowed) redirect("/dashboard");
  return children;
}
