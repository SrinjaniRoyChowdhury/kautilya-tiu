"use client";

import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[#1a1208] group-[.toaster]:text-parchment-100 group-[.toaster]:border-gold-400/30 group-[.toaster]:shadow-xl group-[.toaster]:rounded-md font-sans",
          description: "group-[.toast]:text-parchment-300",
          actionButton:
            "group-[.toast]:bg-gold-500 group-[.toast]:text-ink group-[.toast]:font-medium",
          cancelButton:
            "group-[.toast]:bg-amber-950 group-[.toast]:text-parchment-200",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
