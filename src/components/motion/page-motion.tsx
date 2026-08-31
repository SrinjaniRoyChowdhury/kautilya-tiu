"use client";

import { cn } from "@/lib/utils";
import { MotionReveal } from "@/components/motion/reveal";

export function MotionPageHeader({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <MotionReveal as="header" className={cn("mb-10 max-w-3xl", className)} immediate>
      {eyebrow ? (
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-gold-700">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="font-serif text-4xl font-semibold tracking-tight text-gold-gradient sm:text-5xl">
        {title}
      </h1>
      {description ? <p className="mt-3 text-base text-ink-muted">{description}</p> : null}
    </MotionReveal>
  );
}
