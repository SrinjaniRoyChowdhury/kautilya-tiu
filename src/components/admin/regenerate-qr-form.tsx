"use client";

import { useActionState } from "react";
import { regenerateQrAction, type QrActionState } from "@/app/actions/qr";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function RegenerateQrForm({ registrationId }: { registrationId: string }) {
  const action = regenerateQrAction.bind(null, registrationId);
  const [state, formAction, pending] = useActionState(action, {} as QrActionState);
  return (
    <form action={formAction} className="grid min-w-[16rem] gap-2">
      {state.error ? (
        <p className="text-sm text-red-800" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="text-sm" role="status">
          {state.success}
        </p>
      ) : null}
      <Field label="Revoke reason" htmlFor={`reason-${registrationId}`}>
        <Input id={`reason-${registrationId}`} name="reason" required minLength={3} />
      </Field>
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {pending ? "Revoking…" : "Regenerate QR"}
      </Button>
    </form>
  );
}
