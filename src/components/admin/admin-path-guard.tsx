"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { isAdminPathAllowed } from "@/lib/staff-access";

export function AdminPathGuard({ roles, home }: { roles: string[]; home: string }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isAdminPathAllowed(pathname, roles)) router.replace(home);
  }, [home, pathname, roles, router]);

  return null;
}
