"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/format";

const baseItems = [
  { href: "/dashboard", label: "Overview", match: (path: string) => path === "/dashboard" },
  {
    href: "/dashboard/register",
    label: "Registration",
    match: (path: string) => path.startsWith("/dashboard/register"),
  },
  {
    href: "/dashboard/pay",
    label: "Payment",
    match: (path: string) => path.startsWith("/dashboard/pay"),
  },
  {
    href: "/dashboard/qr",
    label: "Credential",
    match: (path: string) => path.startsWith("/dashboard/qr"),
  },
  {
    href: "/dashboard/profile",
    label: "Profile",
    match: (path: string) => path.startsWith("/dashboard/profile"),
  },
];

const teamItem = {
  href: "/dashboard/team",
  label: "My team",
  match: (path: string) => path.startsWith("/dashboard/team"),
};

export function DashboardNav({ showTeam = false }: { showTeam?: boolean }) {
  const pathname = usePathname() || "/dashboard";
  const items = showTeam ? [...baseItems, teamItem] : baseItems;

  return (
    <nav className="mb-8 flex flex-wrap gap-2" aria-label="Dashboard">
      {items.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            className={cn(
              "rounded-sm px-3 py-1.5 text-sm",
              active
                ? "bg-gold-700 text-parchment-50"
                : "border border-gold-700/25 text-gold-700 hover:bg-parchment-200",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
