import Image from "next/image";
import { cn } from "@/lib/format";

export function BrandLogo({
  className,
  priority = false,
  sizes = "48px",
}: {
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  return (
    <Image
      src="/KautilyaLogo.png"
      alt="Kautilya MUN"
      width={500}
      height={500}
      sizes={sizes}
      className={cn("object-contain", className)}
      priority={priority}
    />
  );
}
