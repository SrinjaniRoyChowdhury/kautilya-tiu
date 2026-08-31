import Link from "next/link";
import { cn } from "@/lib/format";

const baseItems = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/register", label: "Registration" },
  { href: "/dashboard/pay", label: "Payment" },
  { href: "/dashboard/qr", label: "Credential" },
  { href: "/dashboard/profile", label: "Profile" },
];

const teamItem = { href: "/dashboard/team", label: "My team" };

export function DashboardNav({
  current,
  showTeam = false,
}: {
  current: string;
  showTeam?: boolean;
}) {
  const items = showTeam
    ? [...baseItems.slice(0, 5), teamItem]
    : baseItems;

  return (
    <nav className="mb-8 flex flex-wrap gap-2" aria-label="Dashboard">
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

export async function dashboardNavProps() {
  const { getMyTeamContext } = await import("@/lib/groups");
  const team = await getMyTeamContext();
  return { showTeam: Boolean(team) };
}
