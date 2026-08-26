"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ActionFeedback } from "@/components/ui/feedback";
import { resendVerificationAction, type RegistrationState } from "@/app/actions/registrations";

export function ResendVerification() {
  const [state, action, pending] = useActionState(resendVerificationAction, {} as RegistrationState);
  return (
    <form action={action} className="mt-4">
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Sending…" : "Resend verification email"}
      </Button>
      <ActionFeedback error={state.error} success={state.success} />
    </form>
  );
}
