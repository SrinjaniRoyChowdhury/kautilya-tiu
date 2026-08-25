"use client";

import { useActionState } from "react";
import {
  deleteParticipantAction,
  setParticipantPasswordAction,
  type ParticipantAdminState,
} from "@/app/actions/participants";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import type { AdminParticipant } from "@/types";

export function ParticipantPasswordForm({ registrationId }: { registrationId: string }) {
  const action = setParticipantPasswordAction.bind(null, registrationId);
  const [state, formAction, pending] = useActionState(action, {} as ParticipantAdminState);
  return (
    <form action={formAction} className="grid gap-4">
      {state.error ? (
        <p className="rounded-sm bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="rounded-sm bg-parchment-200 px-3 py-2 text-sm" role="status">
          {state.success}
        </p>
      ) : null}
      <Field
        label="New password"
        htmlFor="password"
        hint="At least 8 characters, with upper, lower, and a number."
      >
        <Input id="password" name="password" type="password" required autoComplete="new-password" />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Update password"}
      </Button>
    </form>
  );
}

export function DeleteParticipantForm({ participant }: { participant: AdminParticipant }) {
  const action = deleteParticipantAction.bind(null, participant.id);
  const [state, formAction, pending] = useActionState(action, {} as ParticipantAdminState);
  if (participant.paid) {
    return (
      <p className="text-sm text-ink-muted">
        This delegate cannot be deleted because a payment is verified or still under review.
      </p>
    );
  }
  return (
    <form action={formAction} className="grid gap-3">
      {state.error ? (
        <p className="rounded-sm bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {state.error}
        </p>
      ) : null}
      <p className="text-sm text-ink-muted">
        Removes {participant.full_name} from this edition. Only allowed before payment.
      </p>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Deleting…" : "Delete unpaid participant"}
      </Button>
    </form>
  );
}
