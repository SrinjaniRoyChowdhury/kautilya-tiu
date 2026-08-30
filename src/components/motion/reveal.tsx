"use client";

import { motion, type Variants } from "framer-motion";
import { useSyncExternalStore, type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

type RevealTag = "div" | "section" | "header" | "article" | "li" | "ul" | "dl" | "aside";

const STATIC_TAGS: Record<RevealTag, ElementType> = {
  div: "div",
  section: "section",
  header: "header",
  article: "article",
  li: "li",
  ul: "ul",
  dl: "dl",
  aside: "aside",
};

function useMotionReady() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

type MotionRevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: RevealTag;
  /** Animate on mount instead of when scrolled into view. */
  immediate?: boolean;
  id?: string;
  "aria-labelledby"?: string;
};

export function MotionReveal({
  children,
  className,
  delay = 0,
  as = "div",
  immediate = false,
  id,
  "aria-labelledby": ariaLabelledby,
}: MotionRevealProps) {
  const ready = useMotionReady();
  const StaticTag = STATIC_TAGS[as];
  const htmlProps = { id, "aria-labelledby": ariaLabelledby };

  if (!ready) {
    return (
      <StaticTag className={cn(className)} {...htmlProps}>
        {children}
      </StaticTag>
    );
  }

  const Component = motion[as];

  return (
    <Component
      className={cn(className)}
      {...htmlProps}
      initial={{ opacity: 0, y: 22 }}
      {...(immediate
        ? { animate: { opacity: 1, y: 0 } }
        : { whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount: 0.15 } })}
      transition={{ duration: 0.55, delay, ease }}
    >
      {children}
    </Component>
  );
}

export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease },
  },
};

export function MotionStagger({
  children,
  className,
  immediate = false,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  immediate?: boolean;
  as?: RevealTag;
}) {
  const ready = useMotionReady();
  const StaticTag = STATIC_TAGS[as];

  if (!ready) {
    return <StaticTag className={className}>{children}</StaticTag>;
  }

  const Component = motion[as];

  return (
    <Component
      className={className}
      variants={staggerContainer}
      initial="hidden"
      {...(immediate ? { animate: "show" } : { whileInView: "show", viewport: { once: true, amount: 0.12 } })}
    >
      {children}
    </Component>
  );
}

export function MotionStaggerItem({
  children,
  className,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: RevealTag;
}) {
  const ready = useMotionReady();
  const StaticTag = STATIC_TAGS[as];

  if (!ready) {
    return <StaticTag className={className}>{children}</StaticTag>;
  }

  const Component = motion[as];

  return (
    <Component className={className} variants={staggerItem}>
      {children}
    </Component>
  );
}
