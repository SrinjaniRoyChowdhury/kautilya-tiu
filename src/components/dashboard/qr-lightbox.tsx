"use client";

import { useEffect, useState } from "react";

export function QrLightbox({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex flex-col items-center gap-2 rounded-sm focus:outline-none focus:ring-2 focus:ring-gold-700"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          width={280}
          height={280}
          className="rounded-sm border border-gold-700/20 bg-parchment-50"
        />
        <span className="text-xs text-gold-700">Tap the QR to fill the screen for scanning</span>
      </button>
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Credential QR"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 p-4"
          onClick={() => setOpen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="max-h-[min(92vh,92vw)] max-w-[min(92vh,92vw)] rounded-sm bg-white p-4"
          />
        </div>
      ) : null}
    </>
  );
}
