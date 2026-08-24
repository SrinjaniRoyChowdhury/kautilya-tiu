"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { resendVerificationAction, type RegistrationState } from "@/app/actions/registrations";

export function ResendVerification() {
  const [state, action, pending] = useActionState(resendVerificationAction, {} as RegistrationState);
  return (
    <form action={action} className="mt-4">
      {state.error ? (
        <p className="mb-2 text-sm text-red-800" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="mb-2 text-sm text-ink" role="status">
          {state.success}
        </p>
      ) : null}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Sending…" : "Resend verification email"}
      </Button>
    </form>
  );
}
