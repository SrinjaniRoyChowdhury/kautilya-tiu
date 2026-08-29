import Link from "next/link";
import { HiArrowLeft } from "react-icons/hi";
import { cn } from "@/lib/format";

export function BackLink({
  href,
  label,
  className,
}: {
  href: string;
  label: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-gold-700 hover:underline",
        className,
      )}
    >
      <HiArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
      {label}
    </Link>
  );
}
