"use client";

import { useActionState } from "react";
import {
  confirmParticipantFreeAction,
  deleteParticipantAction,
  setParticipantPasswordAction,
  type ParticipantAdminState,
} from "@/app/actions/participants";
import { Button } from "@/components/ui/button";
import { ActionFeedback } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import type { AdminParticipant } from "@/types";

export function ParticipantPasswordForm({ registrationId }: { registrationId: string }) {
  const action = setParticipantPasswordAction.bind(null, registrationId);
  const [state, formAction, pending] = useActionState(action, {} as ParticipantAdminState);
  return (
    <form action={formAction} className="grid gap-4">
      <Field
        label="New password"
        htmlFor="password"
        hint="At least 8 characters, with upper, lower, and a number."
      >
        <PasswordInput id="password" name="password" required autoComplete="new-password" />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Update password"}
      </Button>
      <ActionFeedback error={state.error} success={state.success} />
    </form>
  );
}

export function DeleteParticipantForm({ participant }: { participant: AdminParticipant }) {
  const action = deleteParticipantAction.bind(null, participant.id);
  const [state, formAction, pending] = useActionState(action, {} as ParticipantAdminState);
  if (participant.paid || participant.confirmed_free) {
    return (
      <form action={formAction} className="grid gap-4">
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Caution:</strong> This participant has a confirmed registration or recorded payment. Deleting them requires admin re-authentication and a mandatory reason for the audit trail.
        </div>
        <Field label="Admin Username / Email" htmlFor="admin_username">
          <Input
            id="admin_username"
            name="admin_username"
            required
            autoComplete="username"
            placeholder="e.g. admin or admin@kautilya.local"
          />
        </Field>
        <Field label="Admin Password" htmlFor="admin_password">
          <PasswordInput id="admin_password" name="admin_password" required autoComplete="current-password" />
        </Field>
        <Field
          label="Reason for deletion"
          htmlFor="reason"
          hint="This reason will be visible permanently in the audit log."
        >
          <Input id="reason" name="reason" required placeholder="e.g. Duplicate registration / refunded" />
        </Field>
        <Button
          type="submit"
          variant="secondary"
          disabled={pending}
          className="text-red-700 border-red-300 hover:bg-red-50"
        >
          {pending ? "Deleting…" : "Authorize & delete paid participant"}
        </Button>
        <ActionFeedback error={state.error} success={state.success} />
      </form>
    );
  }
  return (
    <form action={formAction} className="grid gap-3">
      <p className="text-sm text-ink-muted">
        Removes {participant.full_name} from this edition. Only allowed before payment.
      </p>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Deleting…" : "Delete unpaid participant"}
      </Button>
      <ActionFeedback error={state.error} success={state.success} />
    </form>
  );
}

export function ConfirmFreeParticipantForm({ participant }: { participant: AdminParticipant }) {
  const action = confirmParticipantFreeAction.bind(null, participant.id);
  const [state, formAction, pending] = useActionState(action, {} as ParticipantAdminState);

  if (participant.confirmed_free) {
    return (
      <p className="text-sm text-ink-muted">
        Confirmed as a free participant. No payment was recorded.
      </p>
    );
  }
  if (participant.paid || participant.status === "CONFIRMED") {
    return null;
  }
  if (participant.status === "DRAFT" || participant.status === "CANCELLED") {
    return (
      <p className="text-sm text-ink-muted">They must submit a registration before confirmation.</p>
    );
  }

  return (
    <form action={formAction} className="grid gap-3">
      <p className="text-sm text-ink-muted">
        Confirm without payment. They receive a credential and appear under Free Participants on the
        admin overview. Revenue is unaffected.
      </p>
      <Button type="submit" disabled={pending}>
        {pending ? "Confirming…" : "Confirm as free participant"}
      </Button>
      <ActionFeedback error={state.error} success={state.success} />
    </form>
  );
}
