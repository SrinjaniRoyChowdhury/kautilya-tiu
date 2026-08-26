"use client";

import { useActionState } from "react";
import { regenerateQrAction, type QrActionState } from "@/app/actions/qr";
import { Button } from "@/components/ui/button";
import { ActionFeedback } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";

export function RegenerateQrForm({
  registrationId,
  compact = false,
}: {
  registrationId: string;
  compact?: boolean;
}) {
  const action = regenerateQrAction.bind(null, registrationId);
  const [state, formAction, pending] = useActionState(action, {} as QrActionState);
  return (
    <form
      action={formAction}
      className={compact ? "flex min-w-[11rem] flex-col items-end gap-1" : "grid min-w-[16rem] gap-2"}
    >
      {compact ? (
        <Input
          id={`reason-${registrationId}`}
          name="reason"
          required
          minLength={3}
          placeholder="Revoke reason"
          className="h-8 py-1 text-xs"
        />
      ) : (
        <Field label="Revoke reason" htmlFor={`reason-${registrationId}`}>
          <Input id={`reason-${registrationId}`} name="reason" required minLength={3} />
        </Field>
      )}
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {pending ? "Revoking…" : compact ? "Regen QR" : "Regenerate QR"}
      </Button>
      <ActionFeedback error={state.error} success={state.success} className="text-xs" />
    </form>
  );
}
