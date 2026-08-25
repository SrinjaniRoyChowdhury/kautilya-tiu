import Link from "next/link";
import { cn } from "@/lib/format";

const items = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/editions", label: "Editions" },
  { href: "/admin/committees", label: "Committees" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/credentials", label: "Credentials" },
  { href: "/admin/scanners", label: "Scanners" },
  { href: "/admin/attendance", label: "Venue" },
  { href: "/admin/cms", label: "Content" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/audit", label: "Audit" },
];

export function AdminNav({ current }: { current: string }) {
  return (
    <nav className="mb-8 flex flex-wrap gap-2" aria-label="Admin">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "rounded-sm px-3 py-1.5 text-sm",
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
