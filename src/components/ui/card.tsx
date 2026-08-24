import { cn } from "@/lib/format";
import type { HTMLAttributes } from "react";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "frame-gold rounded-sm bg-parchment-50/85 p-6 backdrop-blur-sm",
        className,
      )}
      {...props}
    />
  );
}

export function Container({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6", className)} {...props} />
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <header className="mb-10 max-w-3xl">
      {eyebrow ? (
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-gold-700">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="font-serif text-4xl font-semibold tracking-tight text-gold-gradient sm:text-5xl">
        {title}
      </h1>
      {description ? <p className="mt-3 text-base text-ink-muted">{description}</p> : null}
    </header>
  );
}
