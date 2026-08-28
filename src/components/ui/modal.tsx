"use client";

import { useEffect, type ReactNode } from "react";
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
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4"
      onClick={onClose}
    >
      <div
        className={cn(
          "frame-gold max-h-[90vh] w-full overflow-y-auto bg-parchment-50 p-6",
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
