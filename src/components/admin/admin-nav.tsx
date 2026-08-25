import Link from "next/link";
import { cn } from "@/lib/format";

const items = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/editions", label: "Editions" },
  { href: "/admin/committees", label: "Committees" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/participants", label: "Participants" },
  { href: "/admin/credentials", label: "Credentials" },
  { href: "/admin/scanners", label: "Scanners" },
  { href: "/admin/editors", label: "Editors" },
  { href: "/admin/attendance", label: "Venue" },
  { href: "/admin/cms", label: "Content" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/audit", label: "Audit" },
];

export function AdminNav({ current, className }: { current: string; className?: string }) {
  return (
    <nav
      className={cn("mb-4 flex gap-2 overflow-x-auto pb-1 font-heading", className)}
      aria-label="Admin"
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "shrink-0 rounded-sm px-2.5 py-1 text-sm",
            current === item.href
              ? "bg-gold-700 text-parchment-50"
              : "border border-gold-700/25 text-gold-700 hover:bg-parchment-200",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
