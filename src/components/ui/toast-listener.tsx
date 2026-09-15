"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import { toast } from "sonner";

function ToastListenerContent() {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  useEffect(() => {
    const toastType = searchParams.get("toast");
    if (!toastType) return;

    if (toastType === "signed_in") {
      toast.success("Successfully signed in!", {
        description: "Welcome back to Kautilya.",
      });
    } else if (toastType === "email_confirmed") {
      toast.success("Sign up successful & email confirmed!", {
        description: "Your email has been verified. Welcome to Kautilya.",
      });
    } else if (toastType === "registered") {
      toast.success("Registration submitted successfully!", {
        description: "Your registration details have been saved.",
      });
    }

    // Clean up the toast query parameter from URL without page reload
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.delete("toast");
    const newSearch = newParams.toString();
    const newUrl = newSearch ? `${pathname}?${newSearch}` : pathname;
    window.history.replaceState(null, "", newUrl);
  }, [searchParams, pathname]);

  return null;
}

export function ToastListener() {
  return (
    <Suspense fallback={null}>
      <ToastListenerContent />
    </Suspense>
  );
}
