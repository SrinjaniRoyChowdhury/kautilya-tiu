"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/format";

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
  wide?: boolean;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[100] overflow-y-auto bg-ink/70"
      onClick={onClose}
    >
      <div className="flex min-h-full items-center justify-center p-4 pt-[calc(var(--site-header-height)+1rem)] pb-6 sm:p-6 sm:pt-[calc(var(--site-header-height)+1.5rem)]">
        <div
          className={cn(
            "frame-gold w-full overflow-y-auto bg-parchment-50 p-6",
            "max-h-[calc(100dvh-var(--site-header-height)-2rem)]",
            wide ? "max-w-2xl" : "max-w-lg",
            className,
          )}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <p className="font-serif text-2xl text-gold-700">{title}</p>
            <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Close">
              Close
            </Button>
          </div>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function ModalTrigger({
  label,
  onOpen,
  variant = "primary",
}: {
  label: string;
  onOpen: () => void;
  variant?: "primary" | "secondary";
}) {
  return (
    <Button type="button" variant={variant === "secondary" ? "secondary" : "primary"} onClick={onOpen}>
      {label}
    </Button>
  );
}
