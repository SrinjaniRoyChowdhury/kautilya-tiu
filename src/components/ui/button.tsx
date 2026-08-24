import { cn } from "@/lib/format";
import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "sm";
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}: Props) {
  const variants = {
    primary:
      "bg-gold-700 text-parchment-50 hover:bg-[#74541f] disabled:opacity-50",
    secondary:
      "border border-gold-700/50 bg-parchment-50/70 text-gold-700 hover:bg-parchment-200",
    ghost: "text-gold-700 hover:bg-parchment-200/70",
  };
  const sizes = {
    md: "h-11 px-5 text-sm",
    sm: "h-9 px-3 text-sm",
  };
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-sm font-medium tracking-wide transition-colors",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
