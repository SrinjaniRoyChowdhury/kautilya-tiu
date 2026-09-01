"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { cn } from "@/lib/format";
import type { AdminNavItem } from "@/lib/staff-access";

function isCurrent(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav({ items, canScan }: { items: AdminNavItem[]; canScan: boolean }) {
  const pathname = usePathname();
  return (
    <aside className="flex shrink-0 flex-col border-b border-gold-700/20 bg-parchment-50 md:h-full md:w-52 md:overflow-y-auto md:border-b-0 md:border-r">
      <nav className="flex gap-1 overflow-x-auto px-3 py-2 font-heading md:flex-1 md:flex-col md:gap-0.5 md:px-3 md:py-4" aria-label="Admin">
        {items.map((item) => {
          const current = isCurrent(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "shrink-0 rounded-sm px-3 py-2 text-sm",
                current
                  ? "bg-gold-700 text-parchment-50"
                  : "text-gold-700 hover:bg-parchment-200",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <nav
        className="flex gap-1 overflow-x-auto border-t border-gold-700/15 px-3 py-2 font-heading md:flex-col md:gap-0.5 md:px-3 md:py-3"
        aria-label="Account"
      >
        {canScan ? (
          <Link href="/scan" className="shrink-0 rounded-sm px-3 py-2 text-sm text-gold-700 hover:bg-parchment-200">
            Scan
          </Link>
        ) : null}
        <Link href="/dashboard" className="shrink-0 rounded-sm px-3 py-2 text-sm text-gold-700 hover:bg-parchment-200">
          Dashboard
        </Link>
        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full shrink-0 rounded-sm px-3 py-2 text-left text-sm whitespace-nowrap text-gold-700 hover:bg-parchment-200"
          >
            Sign out
          </button>
        </form>
      </nav>
    </aside>
  );
}
