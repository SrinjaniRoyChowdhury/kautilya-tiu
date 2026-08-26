"use client";

import { useActionState } from "react";
import { resendQrEmailAction, type QrActionState } from "@/app/actions/qr";
import { Button } from "@/components/ui/button";
import { ActionFeedback } from "@/components/ui/feedback";

export function ResendQrEmail({ registrationId }: { registrationId: string }) {
  const action = resendQrEmailAction.bind(null, registrationId);
  const [state, formAction, pending] = useActionState(action, {} as QrActionState);
  return (
    <form action={formAction} className="mt-6">
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Sending…" : "Email this credential"}
      </Button>
      <ActionFeedback error={state.error} success={state.success} />
    </form>
  );
}
