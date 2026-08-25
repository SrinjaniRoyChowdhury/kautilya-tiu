"use client";

import { useActionState } from "react";
import { resendQrEmailAction, type QrActionState } from "@/app/actions/qr";
import { Button } from "@/components/ui/button";

export function ResendQrEmail({ registrationId }: { registrationId: string }) {
  const action = resendQrEmailAction.bind(null, registrationId);
  const [state, formAction, pending] = useActionState(action, {} as QrActionState);
  return (
    <form action={formAction} className="mt-6">
      {state.error ? (
        <p className="mb-2 text-sm text-red-800" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="mb-2 text-sm" role="status">
          {state.success}
        </p>
      ) : null}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Sending…" : "Email this credential"}
      </Button>
    </form>
  );
}
